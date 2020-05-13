export interface Configuration {
    contact: string;
    file?: string;
    footer?: string;
    push: "commit_default" | "commit" | "pr_default" | "pr";
}
