#include <mylib/interface.h>
#include <string>

namespace MyLib {

Message::Message(std::string const& data)
    : m_data(data) {}

std::string const& Message::get() {
    return m_data;
}

void Message::set(std::string const& data) {
    m_data = data;
}
};
