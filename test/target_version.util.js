
/*

Takes the current version (major.minor.patch) and returns the previous patch version.

For a version like `v1.0.0` this would return `undefined`

For a version like `v1.0.1` this would return `v1.0.0`

*/
function getPreviousVersion(current_version, abi_crosswalk) {
  const current_parts = current_version.split('.').map((i) => { return +i; });
  const major = current_parts[0];
  const minor = current_parts[1];
  let patch = current_parts[2];
  while (patch > 0) {
    --patch;
    const new_target = '' + major + '.' + minor + '.' + patch;
    if (new_target == current_version) {
      break;
    }
    if (abi_crosswalk[new_target]) {
      return new_target;
    }
  }
  // failed to find suitable future version that we expect is ABI compatible
  return undefined;
}

module.exports = getPreviousVersion;
