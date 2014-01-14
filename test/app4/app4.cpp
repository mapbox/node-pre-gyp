// v8
#include <v8.h>

// node.js
#include <node.h>

#include <mylib/interface.h>

static v8::Handle<v8::Value> get_hello(const v8::Arguments& args)
{
    v8::HandleScope scope;
    MyLib::Message msg("hello");
    std::string msg_string = msg.get();
    return scope.Close(v8::String::New(msg_string.c_str()));
}

extern "C" {
    static void start(v8::Handle<v8::Object> target) {
        v8::HandleScope scope;
        NODE_SET_METHOD(target, "hello", get_hello);
    }
}

NODE_MODULE(app4, start)

