#ifndef FOO_HPP
#define FOO_HPP

#ifdef DEBUG
#define HELLO_WORLD "hello-debug"
#else
#define HELLO_WORLD "hello-release"
#endif
#endif
