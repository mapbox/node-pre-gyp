// v8
#include <v8.h>

// node.js
#include <node.h>
#include <node_version.h>

#if (NODE_MODULE_VERSION > 0x000B)

    static void get_hello(const v8::FunctionCallbackInfo<v8::Value>& args)
    {
        v8::HandleScope scope(v8::Isolate::GetCurrent());
        args.GetReturnValue().Set(v8::String::NewFromUtf8(v8::Isolate::GetCurrent(),"hello"));
    }

#else

    static v8::Handle<v8::Value> get_hello(const v8::Arguments& args)
    {
        v8::HandleScope scope;
        return scope.Close(v8::String::New("hello"));
    }

#endif

extern "C" {
    static void start(v8::Handle<v8::Object> target) {
#if (NODE_MODULE_VERSION > 0x000B)
        v8::HandleScope scope(v8::Isolate::GetCurrent());
#else
        v8::HandleScope scope;
#endif
        NODE_SET_METHOD(target, "hello", get_hello);
    }
}

NODE_MODULE(app1, start)

