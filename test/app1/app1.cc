// v8
#include <v8.h>

// node.js
#include <node.h>

static v8::Handle<v8::Value> get_hello(const v8::Arguments& args)
{
    v8::HandleScope scope;
    return scope.Close(v8::String::New("hello"));
}

extern "C" {
    static void start(v8::Handle<v8::Object> target) {
        v8::HandleScope scope;
        NODE_SET_METHOD(target, "hello", get_hello);
    }
}

NODE_MODULE(app1, start)

