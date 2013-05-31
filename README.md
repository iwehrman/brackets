Welcome to Adobe Edge Code!
---------------------------

This repo contains the files for the ongoing development of Adobe Edge Code (http://html.adobe.com/edge/code/) as a fork of the open-source project [Brackets] (https://github.com/adobe/brackets).

There are three branches to be aware of:
- the master branch shadows [Brackets] master;
- the ongoing edge-code branch contains files to re-branch [Brackets] as Adobe Edge Code; and
- the ongoing alf-localization branch is used by the l10n team to push localization updates.

Note: please do not delete any of these branches (eg. when merging pull requests)

[Note: on Windows, all these commands must be run from a Git Bash shell.]

## Setup

To get started with working on this project, do the following:

1. `git clone https://git.corp.adobe.com/edge/edge-code.git`
2. `cd brackets`
3. `git checkout edge-code`
4. `git submodule update --init --recursive`

That's it!  When you run the Edge Code shell, just open `brackets/src/index.html`.

[OPTIONAL] If you need to sync changes with the real brackets repo, do the following:

1. `git remote add public https://github.com/adobe/brackets.git`
2. `git remote add private https://git.corp.adobe.com/edge/edge-code.git`

## Merging brackets changes into master

To integrate the latest brackets into this repo, do the following:

1. `git checkout master`
2. `git submodule update --init --recursive`
3. `git fetch public master`.  This should result in a fast-forward merge.  If there are conflicts, please check that something other than a brackets merge hasn't been committed to master.
4. `git push private master`

Note: this will complete the merge directly into master without the need for a pull request.

## Merging master into edge-code

To integrate the latest changes from master (eg. integrating brackets as above), do the following:

1. `git fetch private`
2. `git checkout edge-code`
3. `git submodule update --init --recursive`
4. `git checkout -b <username/new-branch-name>`
5. `git merge master`
6. `git submodule update --init --recursive`
7. resolve any merge conflicts manually taking care to preserve Edge Code changes that may overlap with new Brackets development
8. build and (unit) test
8. `git add`, `git commit`, and `git push -u private <username/new-branch-name>`

IMPORTANT: when creating a new pull request for `edge-code`, you must set the "base branch" to "edge-code".  Otherwise, your change would be merged into master.

## Merging edge web fonts changes

To integrate the latest extension changes, do the following in a local branch:

1. `cd src/extensions/default/edge-code-web-fonts`
2. `git fetch origin`
3. `git merge origin/master`.
4. Build/test

## Merging edge code inspect changes

Follow exact same steps as for "Merging edge web fonts changes" above, except do so from the `src/extensions/default/edge-code-inspect` directory.

## Tagging a release
To tag a specific release, run the following in both the edge-code and edge-code-shell repos:

1. `git tag -a <tag> -m '<tag msg here>'`
2. `git push origin <tag>`
