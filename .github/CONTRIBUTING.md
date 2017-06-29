# Contributing to Stakhanov

This section will guide you through the contribution process.

### Step 1: Fork

Fork the project [on GitHub](https://github.com/ChauffeurPrive/stakhanov) and clone your fork
locally.

```bash
$ git clone git@github.com:username/stakhanov.git
$ cd stakhanov
$ git remote add upstream https://github.com/ChauffeurPrive/stakhanov.git
```

#### Which branch?

For developing new features and bug fixes, the `master` branch should be pulled
and built upon.

### Step 2: Branch

Create a branch and start hacking:

```bash
$ git checkout -b my-amazing-feature -t origin/master
```

Any text you write should follow the [Style Guide](https://github.com/airbnb/javascript).

### Step 3: Commit

Make sure git knows your name and email address:

```bash
$ git config --global user.name "J. Random User"
$ git config --global user.email "j.random.user@example.com"
```

Add and commit:

```bash
$ git add my/changed/files
$ git commit
```

### Commit message guidelines

The commit message should describe what changed and why.
Example:
```text
Add an optional parameter to createWorkers to configure task completion timeout
```
    
### Step 4: Rebase

Use `git rebase` (not `git merge`) to synchronize your work with the main
repository.

```bash
$ git fetch upstream
$ git rebase upstream/master
```

### Step 5: Test

Bug fixes and features must come with tests. We are using the [mocha javascript 
test framework](https://mochajs.org/) along with [sinon.js](http://sinonjs.org/) for all 
our tests and so should you in your contribution. 

Looking at other tests to see how they should be structured can also help. Add your
tests in the `test/` directory, keeping the same directory structure as the code. Have a
look in the `test/` directory if it seems unclear to you.

To run the tests (including code linting) on Unix / macOS:

```bash
$ npm test
```

Make sure the linter does not report any issues, that all tests pass and that coverage 
remains complete. Please do not submit patches that fail any of these checks.

If you want to run the linter without running tests, use `npm run lint`.

### Step 6: Push

```bash
$ git push origin my-branch
```

Pull requests are usually reviewed within a few days.

### Step 7: Discuss and update

You will probably get feedback or requests for changes to your Pull Request.
To make changes to an existing Pull Request, make the changes to your branch.
When you push that branch to your fork, GitHub will automatically update the
Pull Request.

You can push more commits to your branch:

```bash
$ git add my/changed/files
$ git commit
$ git push origin my-branch
```

Or you can rebase against master:

```bash
$ git fetch --all
$ git rebase origin/master
$ git push --force-with-lease origin my-branch
```

Or you can amend the last commit (for example if you want to change the commit
log).

```bash
$ git add any/changed/files
$ git commit --amend
$ git push --force-with-lease origin my-branch
```

**Important:** The `git push --force-with-lease` command is one of the few ways
to delete history in git. Before you use it, make sure you understand the risks.

Feel free to post a comment in the Pull Request to ping reviewers if you are
awaiting an answer on something.

### Step 8: Landing

In order to land, a Pull Request needs to be reviewed and
[approved](#getting-approvals-for-your-pull-request) by
at least one Chauffeur Privé maintainer and pass a
[CI (Continuous Integration) test run](#ci-testing).
After that, as long as there are no objections
from a maintainer, the Pull Request can be merged. 

When a maintainer lands your Pull Request, they will post
a comment to the Pull Request page mentioning the commit(s) it
landed as. GitHub often shows the Pull Request as `Closed` at this
point, but don't worry. If you look at the branch you raised your
Pull Request against (probably `master`), you should see a commit with
your name on it. Congratulations and thanks for your contribution!

## Additional Notes

### Commit Squashing

When the commits in your Pull Request land, they will be squashed
into one commit per logical change. Metadata will be added to the commit
message (including links to the Pull Request, links to relevant issues,
and the names of the reviewers). The commit history of your Pull Request,
however, will stay intact on the Pull Request page.

### Getting Approvals for Your Pull Request

A Pull Request is approved either by saying LGTM, which stands for
"Looks Good To Me", or by using GitHub's Approve button.
GitHub's Pull Request review feature can be used during the process.
For more information, check out
[the video tutorial](https://www.youtube.com/watch?v=HW0RPaJqm4g)
or [the official documentation](https://help.github.com/articles/reviewing-changes-in-pull-requests/).

After you push new changes to your branch, you need to get
approval for these new changes again, even if GitHub shows "Approved"
because the reviewers have hit the buttons before.

### CI Testing

Every Pull Request needs to be tested
to make sure that it works on the platforms that Node.js
supports. This is done by running the code through the CI system.

Only a maintainer can start a CI run. Usually one of them will do it
for you as approvals for the Pull Request come in.
If not, you can ask a maintainer to start a CI run.

<a id="developers-certificate-of-origin"></a>
## Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

* (a) The contribution was created in whole or in part by me and I
  have the right to submit it under the open source license
  indicated in the file; or

* (b) The contribution is based upon previous work that, to the best
  of my knowledge, is covered under an appropriate open source
  license and I have the right under that license to submit that
  work with modifications, whether created in whole or in part
  by me, under the same open source license (unless I am
  permitted to submit under a different license), as indicated
  in the file; or

* (c) The contribution was provided directly to me by some other
  person who certified (a), (b) or (c) and I have not modified
  it.

* (d) I understand and agree that this project and the contribution
  are public and that a record of the contribution (including all
  personal information I submit with it, including my sign-off) is
  maintained indefinitely and may be redistributed consistent with
  this project or the open source license(s) involved.