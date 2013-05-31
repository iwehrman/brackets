Welcome to Adobe Edge Code!
---------------------------

This repo contains the files for the ongoing development of [Adobe Edge Code] (http://html.adobe.com/edge/code/) as a fork of the open-source project [Brackets] (https://github.com/adobe/brackets).

This repo contains three, persistent branches.  Please do not delete any of these branches (eg. when merging pull requests).
- the master branch shadows Brackets master;
- the ongoing edge-code branch contains files to re-branch Brackets as Adobe Edge Code; and
- the ongoing alf-localization branch is used by the l10n team to push localization updates.

Note: on Windows, all of the following commands must be run from a Git Bash shell.

## Setup

To get started with working on this project, do the following:

    $ git clone https://git.corp.adobe.com/edge/edge-code.git
    $ cd brackets
    $ git checkout edge-code
    $ git submodule update --init --recursive

That's it!  When you run the Edge Code shell, just open `brackets/src/index.html`.

[OPTIONAL] If you need to sync changes with the real brackets repo, do the following to get set up for the steps below:

    $ git remote add public https://github.com/adobe/brackets.git
    $ git remote add private https://git.corp.adobe.com/edge/edge-code.git

## Merging brackets changes into master

To integrate the latest brackets into this repo, do the following:

    $ git checkout master
    $ git submodule update --init --recursive
    $ git fetch public master
    
This should result in a fast-forward merge.  If there are conflicts, please check that something other than a brackets merge hasn't been committed to master.

Finally, 

    $ git push private master

Note: this will complete the merge directly into master without the need for a pull request.

## Merging master into edge-code

To integrate the latest changes from master (eg. integrating brackets as above), do the following:

    $ git fetch private
    $ git checkout edge-code
    $ git submodule update --init --recursive
    $ git checkout -b <username/new-branch-name>
    $ git merge master
    $ git submodule update --init --recursive
    
Now, resolve any merge conflicts manually taking care to preserve Edge Code changes that may overlap with new Brackets development.  Of course, next build and (unit) test.

Finally,

    $ git add <list of changed files>
    $ git commit -m "<log message>"
    $ git push -u private <username/new-branch-name>

**IMPORTANT:** when creating a new pull request for `edge-code`, you must set the `base branch` to `edge-code`.  Otherwise, your change would be merged into master.

## Merging edge web fonts changes

To integrate the latest extension changes, do the following in a local branch:

    $ cd src/extensions/default/edge-code-web-fonts
    $ git fetch origin
    $ git merge origin/master

Don't forget to build and (unit) test before pushing the SHA.

## Merging edge code inspect changes

Follow exact same steps as for "Merging edge web fonts changes" above, except do so from the `src/extensions/default/edge-code-inspect` directory.

## Tagging a release
To tag a specific release, run the following in both the edge-code and edge-code-shell repos:

    $ git tag -a <tag> -m '<tag msg here>'
    $ git push origin <tag>
