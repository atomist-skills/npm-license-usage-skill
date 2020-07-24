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
	Category,
	LineStyle,
	parameter,
	ParameterType,
	resourceProvider,
	skill,
} from "@atomist/skill";
import { NpmLicenseUsageConfiguration } from "./lib/configuration";

export const Skill = skill<NpmLicenseUsageConfiguration & { repos: any }>({
	name: "npm-license-usage-skill",
	namespace: "atomist",
	displayName: "npm License Usage",
	author: "Atomist",
	categories: [Category.Dependencies, Category.ProjectManagement],
	license: "Apache-2.0",
	homepageUrl: "https://github.com/atomist-seeds/npm-license-usage-skill",
	repositoryUrl: "https://github.com/atomist-seeds/npm-license-usage-skill.git",
	iconUrl: "file://docs/images/icon.svg",

	runtime: {
		memory: 2048,
		timeout: 540,
	},

	resourceProviders: {
		github: resourceProvider.gitHub({ minRequired: 1 }),
		slack: resourceProvider.chat({ minRequired: 0 }),
	},

	parameters: {
		contact: {
			type: ParameterType.String,
			displayName: "Contact email",
			description:
				"Email address to contact in case of questions regarding license usage",
			required: true,
		},
		file: {
			type: ParameterType.String,
			displayName: "Path of license usage file",
			description:
				"Relative path of the license usage file within the repository",
			required: false,
			placeHolder: "legal/THIRD_PARTY.md",
		},
		footer: {
			type: ParameterType.String,
			displayName: "Footer of license usage file",
			description:
				"Additional Markdown footer that goes at the end of the license usage file",
			required: false,
			lineStyle: LineStyle.Multiple,
		},
		push: parameter.pushStrategy({
			displayName: "Update license information",
			description:
				"Control how and when license usage information should be pushed into the repository",
			required: false,
		}),
		labels: {
			type: ParameterType.StringArray,
			displayName: "Pull request labels",
			description:
				"Add additional labels to pull requests raised by this skill, e.g. to configure the [auto-merge](https://go.atomist.com/catalog/skills/atomist/github-auto-merge-skill) behavior.",
			required: false,
		},
		repos: parameter.repoFilter({ required: false }),
	},

	subscriptions: ["file://graphql/subscription/*.graphql"],
});
