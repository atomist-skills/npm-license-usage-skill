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

import { gitHubResourceProvider, slackResourceProvider } from "@atomist/skill/lib/resource_providers";
import { LineStyle, ParameterType, repoFilter, skill } from "@atomist/skill/lib/skill";
import { NpmLicenseUsageConfiguration } from "./lib/configuration";

export const Skill = skill<NpmLicenseUsageConfiguration & { repos: any }>({
    runtime: {
        memory: 2048,
        timeout: 540,
    },

    resourceProviders: {
        github: gitHubResourceProvider({ minRequired: 1 }),
        slack: slackResourceProvider({ minRequired: 0 }),
    },

    parameters: {
        contact: {
            type: ParameterType.String,
            displayName: "Contact email",
            description: "Email address to contact in case of questions regarding license usage",
            required: true,
        },
        file: {
            type: ParameterType.String,
            displayName: "Path of license usage file",
            description: "Relative path of the license usage file within the repository",
            required: false,
            placeHolder: "legal/THIRD_PARTY.md",
        },
        footer: {
            type: ParameterType.String,
            displayName: "Footer of license usage file",
            description: "Additional Markdown footer that goes at the end of the license usage file",
            required: false,
            lineStyle: LineStyle.Multiple,
        },
        push: {
            type: ParameterType.SingleChoice,
            displayName: "Update license information",
            description: "Control how and when license usage information should be pushed into the repository",
            defaultValue: "pr_default_commit",
            options: [
                {
                    text: "Raise pull request for default branch; commit to other branches",
                    value: "pr_default_commit",
                },
                {
                    text: "Raise pull request for default branch only",
                    value: "pr_default",
                },
                {
                    text: "Raise pull request for any branch",
                    value: "pr",
                },
                {
                    text: "Commit to default branch only",
                    value: "commit_default",
                },
                {
                    text: "Commit to any branch",
                    value: "commit",
                },
            ],
            required: false,
        },
        labels: {
            type: ParameterType.StringArray,
            displayName: "Pull request labels",
            description:
                "Add additional labels to pull requests raised by this skill, e.g. to configure the [auto-merge](https://go.atomist.com/catalog/skills/atomist/github-auto-merge-skill) behavior.",
            required: false,
        },
        repos: repoFilter({ required: false }),
    },

    subscriptions: ["file://graphql/subscription/*.graphql"],
});
