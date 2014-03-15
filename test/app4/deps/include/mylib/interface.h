#ifndef INCLUDE_MYLIB_INTERFACE_H_
#define INCLUDE_MYLIB_INTERFACE_H_

#include <string>

#ifdef _WIN64
#define MYLIB_EXPORT __declspec (dllexport)
#elif _WIN32
#define MYLIB_EXPORT __declspec (dllexport)
#elif __GNUC__ >= 4
#define MYLIB_EXPORT __attribute__ ((visibility ("default")))
#else
#define MYLIB_EXPORT
#endif

namespace MyLib {

class MYLIB_EXPORT Message {
 public:
    explicit Message(std::string const& data);
    std::string const& get();
    void set(std::string const& data);

 private:
    std::string m_data;
};
};

#endif  // INCLUDE_MYLIB_INTERFACE_H_
