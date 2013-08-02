Welcome to Adobe Edge Code!
---------------------------
 
This repo contains the files for the ongoing development of [Adobe Edge Code] (http://html.adobe.com/edge/code/) as a fork of the open-source project [Brackets] (https://github.com/adobe/brackets).

This repo contains three, persistent branches.  Please do not delete any of these branches (eg. when merging pull requests).
- the `master` branch contains files to re-branch Brackets as Adobe Edge Code;
- the ongoing `brackets` branch shadows Brackets master; and
- the ongoing `alf-localization` branch is used by the l10n team to push localization updates.

Note: on Windows, all of the following commands must be run from a Git Bash shell.

## Setup

To get started with working on this project, do the following:

    $ git clone git@git.corp.adobe.com:edge/edge-code.git
    $ cd edge-code
    $ git submodule update --init --recursive

That's it!  When you run the Edge Code shell, just open `src/index.html`.

**OPTIONAL** If you need to sync changes with the real brackets repo, do the following to get set up for the steps below:

    $ git remote add public https://github.com/adobe/brackets.git
    $ git remote add private git@git.corp.adobe.com:edge/edge-code.git

Note: instead of defining `private`, you could just use the standard `origin` reference.

## Merging brackets changes into Brackets branch

We use the `brackets` branch of this repo to shadow the real Brackets repo.  No changes should be submitted here, other than those used to merge adobe/brackets.  If you need to submit a change to adobe/brackets, please do so to the open-source project [Brackets] (https://github.com/adobe/brackets).

To integrate the latest brackets into this repo, do the following:

    $ git checkout brackets
    $ git fetch public
    $ git submodule update --init --recursive
    $ git merge public/master
    
This should result in a fast-forward merge.  If there are conflicts, please check that something other than a brackets merge hasn't been committed to master.

Finally, 

    $ git push private brackets

This will complete the merge directly into master without the need for a pull request.  Since this `brackets` branch merely shadows the real Brackets repo, you do not need to create a pull request when submitting changes to this branch.

## Merging Brackets branch into master

Edge Code is built and released off of the `master` branch.  As such, in addition to committing new Edge Code changes here, we'll periodically need to merge the latest Brackets changes as well.  To do so, please complete the "Merging brackets changes into Brackets branch" instructions above first.  Then, follow these steps to merge those adobe/brackets changes from the `brackets` branch into `master`.

To integrate the latest changes from the Brackets branch (eg. integrating brackets as above), do the following:

    $ git fetch private
    $ git checkout master
    $ git submodule update --init --recursive
    $ git checkout -b <username/new-branch-name>
    $ git merge origin/brackets
    $ git submodule update --init --recursive
    
Now, resolve any merge conflicts manually taking care to preserve Edge Code changes that may overlap with new Brackets development.  Of course, next build and (unit) test.

Next,

    $ git add <list of changed files>
    $ git commit -m "<commit-comment>"
    $ git push -u private <username/new-branch-name>
    
Finally, create and submit a Pull Request for review.

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

    $ git tag -a <tag> -m '<tag-comment>'
    $ git push origin <tag>
