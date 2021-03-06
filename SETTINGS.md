## Before you get started

Connect and configure these integrations:

1.  [**GitHub**](https://go.atomist.com/catalog/integration/github "GitHub Integration")
    _(required)_

## How to configure

1.  **Configure a contact email address**

    Specify an email address that should be added to the license usage file in
    case users want to raise questions.

    Please note that this email address will be committed into the file and
    therefore might be publicly readable.

1.  **Configure the name of the usage file**

    By default, the license usage file is written to `legal/THIRD_PARTY.md`. Use
    this parameter to configure the location and name of the file according to
    your standards.

1.  **Specify content to go into the footer**

    Sometimes you might want to include additional content, like links to legal
    policies and terms of use, to the license usage file. Specify this content
    in this parameter and it will be added as the footer of the file.

1.  **Specify how to commit the license file**

    The following options are available:

    -   **Raise pull request for default branch; commit to other branches** -
        with this option, updates for the default branch will be submitted via a
        pull request; updates on other branches will be committed straight onto
        the branch
    -   **Raise pull request for default branch only** - with this option,
        updates on the default branch will be submitted via a pull request;
        other branches will be ignored
    -   **Raise pull request for any branch** - with this option, updates on all
        branches will be submitted via a pull request
    -   **Commit to default branch only** - with this option, updates on the
        default branch will be committed straight to the branch; other branches
        will be ignored
    -   **Commit to any branch** - with this option, updates on all branches
        will be committed straight to the branch

    Pull requests that get raised by this skill will automatically have a
    reviewer assigned based on the person who pushed code.

1.  **Configure pull request labels**

    Add additional labels to pull requests raised by this skill.

    This is useful to influence how and when the PR should be auto-merged by the
    [Auto-Merge Pull Requests](https://go.atomist.com/catalog/skills/atomist/github-auto-merge-skill)
    skill.

1.  **Determine repository scope**

    ![Repository filter](docs/images/repo-filter.png)

    By default, this skill will be enabled for all repositories in all
    organizations you have connected.

    To restrict the organizations or specific repositories on which the skill
    will run, you can explicitly choose organizations and repositories.

1.  **Activate the skill**

    Save your configuration and activate the skill by clicking the "Enable
    skill" button.
