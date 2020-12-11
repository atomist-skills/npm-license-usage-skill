/*
 * Copyright © 2020 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventContext, project } from "@atomist/skill";
import * as fs from "fs-extra";
import * as lc from "license-checker";
import * as _ from "lodash";
import * as escape from "markdown-escape";
import * as path from "path";
import * as spdx from "spdx-license-list";
import { promisify } from "util";

import { NpmLicenseUsageConfiguration } from "./configuration";
import { UpdateLicenseFileOnPushSubscription } from "./typings/types";

const LicenseMapping = {
	"Apache 2.0": "Apache-2.0",
};

const LicenseFileName = "legal/THIRD_PARTY.md";
const GitattributesFileName = ".gitattributes";

const LicenseTableHeader = ["Name", "Version", "Publisher", "Repository"];

const SummaryTableHadler = ["License", "Count"];

export async function addThirdPartyLicenseFile(
	project: project.Project,
	ctx: EventContext<
		UpdateLicenseFileOnPushSubscription,
		NpmLicenseUsageConfiguration
	>,
): Promise<void> {
	const cfg = ctx.configuration?.parameters;
	const pj = await fs.readJson(project.path("package.json"));
	const projectName =
		pj.name ||
		`@${
			project.id.owner === "atomist-skills" ? "atomist" : project.id.owner
		}/${project.id.repo}`;
	const ownModule = `${projectName}@${pj.version || "0.1.0"}`;

	if (!(await fs.pathExists(project.path("node_modules")))) {
		if (await fs.pathExists(project.path("package-lock.json"))) {
			await project.exec("npm", ["ci"]);
		} else {
			await project.exec("npm", ["install"]);
		}
	}

	const json = await promisify(lc.init)({
		start: project.path(),
		production: true,
	});

	const grouped = {};
	_.forEach(json, (v, k) => {
		if (k === ownModule) {
			return;
		}

		let licenses = v.licenses;

		if (!Array.isArray(licenses)) {
			if (licenses.endsWith("*")) {
				licenses = licenses.slice(0, -1);
			}

			if (licenses.startsWith("(") && licenses.endsWith(")")) {
				licenses = licenses.slice(1, -1);
			}
			licenses = [...(licenses as string).split(" OR ")];
		}

		licenses.forEach(l => {
			let license = l;

			if (LicenseMapping[license]) {
				license = LicenseMapping[license];
			}

			if (grouped[license]) {
				grouped[license] = [
					...grouped[license],
					{
						...v,
						name: k,
					},
				];
			} else {
				grouped[license] = [
					{
						...v,
						name: k,
					},
				];
			}
		});
	});

	const summary = [];
	const counts = _.mapValues(grouped, l => (l as any).length);
	for (const l in counts) {
		if (counts[l]) {
			const anchor = l
				.toLocaleLowerCase()
				.replace(/ /g, "-")
				.replace(/\./g, "")
				.replace(/:/g, "")
				.replace(/\//g, "");
			summary.push([`[${l}](#${anchor})`, counts[l]]);
		}
	}

	const details = [];
	_.forEach(grouped, (v: any, k: any) => {
		const deps = v.map(dep => {
			const ix = dep.name.lastIndexOf("@");
			const name = dep.name.slice(0, ix);
			const version = dep.name.slice(ix + 1);
			return [
				`\`${name}\``,
				`\`${version}\``,
				dep.publisher ? escapeMarkdown(dep.publisher) : "",
				dep.repository ? `[${dep.repository}](${dep.repository})` : "",
			];
		});
		let ld = "";

		if (spdx[k]) {
			ld = `${escapeMarkdown(spdx[k].name)} - [${spdx[k].url}](${
				spdx[k].url
			})\n`;
		}

		details.push(`
#### ${k}

${ld ? `${ld}\n` : ""}${formatTable(LicenseTableHeader, deps)}`);
	});

	const lic = spdx[pj.license]
		? `

\`${projectName}\` is licensed under ${escapeMarkdown(
				spdx[pj.license].name,
		  )} - [${spdx[pj.license].url}](${spdx[pj.license].url}).`
		: "";
	const content = `# \`${projectName}\`${lic}

This page details all runtime dependencies of \`${projectName}\`.

## Licenses

### Summary

${formatTable(SummaryTableHadler, _.sortBy(summary, "[0]"))}
${details.sort((s1, s2) => s1.localeCompare(s2)).join("\n")}

## Contact

Please send any questions or inquires to [${cfg.contact}](mailto:${
		cfg.contact
	}).

---
${cfg.footer ? `\n${cfg.footer.trim()}\n` : ""}`;

	await addGitattribute(project, cfg.file);
	await fs.remove(project.path("node_modules"));
	const file = project.path(cfg.file || LicenseFileName);
	await fs.ensureDir(path.dirname(file));
	await fs.writeFile(file, content);
}

async function addGitattribute(
	p: project.Project,
	file: string,
): Promise<void> {
	const attribute = `${file || LicenseFileName} linguist-generated=true
`;
	if (await fs.pathExists(p.path(GitattributesFileName))) {
		let c = (await fs.readFile(p.path(GitattributesFileName))).toString();
		if (!c.includes(file || LicenseFileName)) {
			c += `
${attribute}`;
			await fs.writeFile(p.path(GitattributesFileName), c);
		}
	} else {
		await fs.writeFile(p.path(GitattributesFileName), attribute);
	}
}

function formatTable(headers: string[], rows: string[][]): string {
	const lines = [];
	const widths = [];
	headers.forEach((h, ix) => {
		widths[ix] = _.maxBy([h, ...rows.map(r => r[ix])], "length").length;
	});
	lines.push(
		`|${headers
			.map((h, ix) => ` ${h.padEnd(widths[ix], " ")} `)
			.join("|")}|`,
	);
	lines.push(
		`|${headers
			.map((h, ix) => ` ${"-".padEnd(widths[ix], "-")} `)
			.join("|")}|`,
	);
	lines.push(
		...rows.map(
			r =>
				`|${r
					.map((h, ix) => ` ${h.toString().padEnd(widths[ix], " ")} `)
					.join("|")}|`,
		),
	);
	return lines.join("\n");
}

function escapeMarkdown(txt: string): string {
	return escape(txt);
}
