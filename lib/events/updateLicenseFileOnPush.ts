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
import { gitHub } from "@atomist/skill/lib/project/github";
import { gitHubAppToken } from "@atomist/skill/lib/secrets";
import * as fs from "fs-extra";
import { Configuration } from "../configuration";
import { addThirdPartyLicenseFile } from "../thirdPartyLicense";
import { UpdateLicenseFileOnPushSubscription } from "../typings/types";

export const handler: EventHandler<UpdateLicenseFileOnPushSubscription, Configuration> = async ctx => {
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

    const credential = await ctx.credential.resolve(gitHubAppToken({
        owner: repo.owner,
        repo: repo.name,
        apiUrl: repo.org.provider.apiUrl,
    }));
    const project = await ctx.project.clone(gitHubComRepository({
        owner: repo.owner,
        repo: repo.name,
        branch: push.branch,
        credential,
    }));

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
        const commitMsg = `Update NPM license usage for ${push.after.sha.slice(0, 7)}\n\n[atomist:generated]\n[atomist-skill:${ctx.skill.namespace}/${ctx.skill.name}]`;
        if (cfg.push.includes("commit")) {
            await git.commit(project, commitMsg);
            await git.push(project);
        } else if (cfg.push.includes("pr")) {
            const branchName = `npm-license-${push.branch}`;
            await git.createBranch(project, branchName);
            await git.commit(project, commitMsg);
            await project.exec("git", ["push", "origin", branchName, "--force"]);

            try {
                const api = gitHub(gitHubComRepository({ owner: repo.owner, repo: repo.name, credential }));
                const pr = (await api.pulls.create({
                    owner: repo.owner,
                    repo: repo.name,
                    title: "NPM License Usage",
                    body: commitMsg,
                    base: push.branch,
                    head: branchName,
                })).data;
                await api.pulls.createReviewRequest({
                    owner: repo.owner,
                    repo: repo.name,
                    pull_number: pr.number, // eslint-disable-line @typescript-eslint/camelcase
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
