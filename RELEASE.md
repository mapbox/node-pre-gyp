# Instructions for making a release

1. Change the version number in package.json. on the command line, in the package root directory, run the following command, replacing <update_type> with one of the semantic versioning release types (prerelease, prepatch, preminor, premajor, patch, minor, major):

npm version <update_type> --preid pre --no-git-tag-version

2. Update the changelog, which can be found in `CHANGELOG.md`. The heading must match `## <VERSION>` exactly, or it will not be picked up. For example, for version 1.0.11:

```
## 1.0.11
```

3. Commit and push the changes. On push the 'node-release' workflow will automaticlly check if the release has been published on npm. If the release has not yet been published, the workflow will build the node binaries and upload them to a new github release, then publish a new npm release.