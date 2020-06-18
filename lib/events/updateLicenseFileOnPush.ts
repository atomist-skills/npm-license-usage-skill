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

import { EventHandler } from "@atomist/skill/lib/handler";
import { gitHubComRepository } from "@atomist/skill/lib/project";
import * as git from "@atomist/skill/lib/project/git";
import { formatMarkers, gitHub } from "@atomist/skill/lib/project/github";
import { gitHubAppToken } from "@atomist/skill/lib/secrets";
import * as fs from "fs-extra";
import { NpmLicenseUsageConfiguration } from "../configuration";
import { addThirdPartyLicenseFile } from "../thirdPartyLicense";
import { UpdateLicenseFileOnPushSubscription } from "../typings/types";

export const handler: EventHandler<UpdateLicenseFileOnPushSubscription, NpmLicenseUsageConfiguration> = async ctx => {
    const push = ctx.data.Push[0];
    const repo = push.repo;
    const cfg = ctx.configuration[0].parameters;

    if (repo.defaultBranch !== push.branch && (cfg.push === "commit_default" || cfg.push === "pr_default")) {
        return {
            code: 0,
            visibility: "hidden",
            reason: "Ignoring push to non-default branch",
        };
    }

    if (push.branch.startsWith("npm-license-")) {
        return {
            code: 0,
            visibility: "hidden",
            reason: "Ignoring push to npm-license branch",
        };
    }

    await ctx.audit.log(`Starting NPM license usage update on ${repo.owner}/${repo.name}`);

    const credential = await ctx.credential.resolve(
        gitHubAppToken({
            owner: repo.owner,
            repo: repo.name,
            apiUrl: repo.org.provider.apiUrl,
        }),
    );
    const project = await ctx.project.clone(
        gitHubComRepository({
            owner: repo.owner,
            repo: repo.name,
            branch: push.branch,
            credential,
        }),
    );

    await ctx.audit.log(`Cloned repository ${repo.owner}/${repo.name} at sha ${push.after.sha.slice(0, 7)}`);

    if (!(await fs.pathExists(project.path("package.json")))) {
        return {
            code: 0,
            visibility: "hidden",
            reason: "Ignoring push to non NPM repository",
        };
    }

    await addThirdPartyLicenseFile(project, ctx);

    if (!(await git.status(project)).isClean) {
        await ctx.audit.log(`Updated NPM license usage`);
        const commitMsg = `NPM license usage update for ${push.after.sha.slice(
            0,
            7,
        )}\n\n[atomist:generated]\n[atomist-skill:${ctx.skill.namespace}/${ctx.skill.name}]`;
        const isDefaultBranch = push.branch === push.repo.defaultBranch;
        const options = {
            name: push.after.author?.name,
            email: push.after.author?.emails?.[0]?.address,
        };
        if (
            cfg.push === "commit" ||
            (isDefaultBranch && cfg.push === "commit_default") ||
            (!isDefaultBranch && cfg.push === "pr_default_commit")
        ) {
            await git.commit(project, commitMsg, options);
            await git.push(project);
        } else if (cfg.push === "pr" || (isDefaultBranch && cfg.push === "pr_default_commit")) {
            const branch = `npm-license-${push.branch}`;
            const changedFiles = (await project.exec("git", ["diff", "--name-only"])).stdout
                .split("\n")
                .map(f => f.trim())
                .filter(f => !!f && f.length > 0)
                .slice(0, -1);
            const body = `Updated NPM license usage file:

${changedFiles.map(f => ` * \`${f}\``).join("\n")}
${formatMarkers(ctx)}
`;

            await git.createBranch(project, branch);
            await git.commit(project, commitMsg, options);
            await git.push(project, { force: true, branch });

            try {
                const api = gitHub(gitHubComRepository({ owner: repo.owner, repo: repo.name, credential }));
                let pr;
                const openPrs = (
                    await api.pulls.list({
                        owner: repo.owner,
                        repo: repo.name,
                        state: "open",
                        base: push.branch,
                        head: `${repo.owner}:${branch}`,
                        per_page: 100,
                    })
                ).data;
                if (openPrs.length === 1) {
                    pr = openPrs[0];
                    await api.pulls.update({
                        owner: repo.owner,
                        repo: repo.name,
                        pull_number: pr.number,
                        body,
                    });
                } else {
                    pr = (
                        await api.pulls.create({
                            owner: repo.owner,
                            repo: repo.name,
                            title: "NPM license usage update",
                            body,
                            base: push.branch,
                            head: branch,
                        })
                    ).data;
                    if (cfg.labels?.length > 0) {
                        await api.issues.update({
                            owner: repo.owner,
                            repo: repo.name,
                            issue_number: pr.number,
                            labels: cfg.labels,
                        });
                    }
                }
                await api.pulls.createReviewRequest({
                    owner: repo.owner,
                    repo: repo.name,
                    pull_number: pr.number,
                    reviewers: [push.after.author.login],
                });
                await ctx.audit.log(`Raised pull request [#${pr.number}](${pr.html_url})`);
                return {
                    code: 0,
                    reason: `Pushed NPM license usage file to [${repo.owner}/${repo.name}](${repo.url}) and raised PR [#${pr.number}](${pr.html_url})`,
                };
            } catch (e) {
                // This might fail if the PR already exists
            }
        }
        return {
            code: 0,
            reason: `Pushed NPM license usage file to [${repo.owner}/${repo.name}](${repo.url})`,
        };
    }

    await ctx.audit.log(`No change to NPM license usage`);
    return {
        code: 0,
        visibility: "hidden",
        reason: `No change to NPM license usage in [${repo.owner}/${repo.name}](${repo.url})`,
    };
};
