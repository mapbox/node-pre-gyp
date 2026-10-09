'use strict';

// url.resolve is deprecated because it invokes the deprecated url.parse() internally
// https://nodejs.org/api/url.html#urlresolvefrom-to
module.exports.resolve = function(from, to) {
  const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
  if (resolvedUrl.protocol === 'resolve:') {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl;

    // To keep consistency with deprecated url.resolve(), we need to remove the leading '/' from pathname
    if (pathname[0] === '/') {
      return pathname.slice(1) + search + hash;
    }

    return pathname + search + hash;
  }
  return resolvedUrl.toString();
};
