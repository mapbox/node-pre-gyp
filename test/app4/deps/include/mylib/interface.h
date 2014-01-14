#ifndef INCLUDE_MYLIB_INTERFACE_H_
#define INCLUDE_MYLIB_INTERFACE_H_

#include <string>

namespace MyLib {

class Message {
 public:
    explicit Message(std::string const& data);
    std::string const& get();
    void set(std::string const& data);

 private:
    std::string m_data;
};
};

#endif  // INCLUDE_MYLIB_INTERFACE_H_
