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

import { createContext } from "@atomist/skill/lib/context";
import { EventIncoming } from "@atomist/skill/lib/payload";
import { guid } from "@atomist/skill/lib/util";
import { handler } from "../lib/events/updateLicenseFileOnPush";

describe("updateLicenseFileOnPush", () => {
    it("should add file", async () => {
        const payload: EventIncoming = {
            data: {
                Push: [
                    {
                        after: {
                            author: {
                                login: "cdupuis",
                            },
                            sha: "a202b9442ecc7fc7557131d97b4c6561972935b6",
                            timestamp: "2020-04-27T12:46:57+02:00",
                            url:
                                "https://github.com/atomist-skills/skill-runner/commit/a202b9442ecc7fc7557131d97b4c6561972935b6",
                        },
                        branch: "master",
                        repo: {
                            channels: [
                                {
                                    name: "skill-runner",
                                    team: {
                                        id: "T29E48P34",
                                    },
                                },
                            ],
                            defaultBranch: "master",
                            name: "skill-runner",
                            org: {
                                provider: {
                                    apiUrl: "https://api.github.com/",
                                    gitUrl: "git@github.com:",
                                },
                            },
                            owner: "atomist-skills",
                            url: "https://github.com/atomist-skills/skill-runner",
                        },
                    },
                ],
            },
            extensions: {
                operationName: "updateLicenseFileOnPush",
                correlation_id: guid(),
                team_id: "T29E48P34",
                team_name: "atomist-community",
            },
            secrets: [
                {
                    uri: "atomist://api-key",
                    value: process.env.API_KEY,
                },
            ],
            skill: {
                id: guid(),
                name: "npm-license-skill",
                namespace: "atomist",
                version: "0.1.0",
                configuration: {
                    instances: [
                        {
                            name: "default",
                            parameters: [
                                {
                                    name: "contact",
                                    value: "oss@atomist.com",
                                },
                                {
                                    name: "push",
                                    value: "pr",
                                },
                            ],
                            resourceProviders: [],
                        },
                    ],
                },
            },
        } as any;

        await handler(createContext(payload as any, {} as any) as any);
    });
});
