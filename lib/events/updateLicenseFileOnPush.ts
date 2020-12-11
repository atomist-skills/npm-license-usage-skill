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

import {
	EventHandler,
	github,
	repository,
	secret,
	status,
} from "@atomist/skill";
import * as fs from "fs-extra";

import { NpmLicenseUsageConfiguration } from "../configuration";
import { addThirdPartyLicenseFile } from "../thirdPartyLicense";
import { UpdateLicenseFileOnPushSubscription } from "../typings/types";

export const handler: EventHandler<
	UpdateLicenseFileOnPushSubscription,
	NpmLicenseUsageConfiguration
> = async ctx => {
	const push = ctx.data.Push[0];
	const repo = push.repo;
	const cfg = ctx.configuration?.parameters;

	if (
		repo.defaultBranch !== push.branch &&
		(cfg.push === "commit_default" || cfg.push === "pr_default")
	) {
		return status.success("Ignoring push to non-default branch").hidden();
	}

	if (push.branch.startsWith("atomist/")) {
		return status.failure(`Ignore generated branch`).hidden();
	}

	await ctx.audit.log(
		`Starting npm license usage update on ${repo.owner}/${repo.name}`,
	);

	const credential = await ctx.credential.resolve(
		secret.gitHubAppToken({
			owner: repo.owner,
			repo: repo.name,
			apiUrl: repo.org.provider.apiUrl,
		}),
	);
	const project = await ctx.project.clone(
		repository.gitHub({
			owner: repo.owner,
			repo: repo.name,
			branch: push.branch,
			credential,
		}),
	);

	await ctx.audit.log(
		`Cloned repository ${repo.owner}/${
			repo.name
		} at sha ${push.after.sha.slice(0, 7)}`,
	);

	if (!(await fs.pathExists(project.path("package.json")))) {
		return status.success("Ignoring push to non-npm repository").hidden();
	}

	await addThirdPartyLicenseFile(project, ctx);

	const commitMsg = `Update npm license usage information\n\n[atomist:generated]\n[atomist-skill:${ctx.skill.namespace}/${ctx.skill.name}]`;
	const branch = `atomist/npm-license-${push.branch}`;

	return await github.persistChanges(
		ctx,
		project,
		cfg.push,
		{
			branch: push.branch,
			defaultBranch: repo.defaultBranch,
			author: {
				name: push.after.author?.name,
				login: push.after.author?.login,
				email: push.after.author?.emails?.[0]?.address,
			},
		},
		{
			branch,
			body: "This pull request updates the npm license usage information",
			title: "Update npm license usage information",
			labels: cfg.labels,
		},
		{ message: commitMsg },
	);
};
