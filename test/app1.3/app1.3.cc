#include <napi.h>

Napi::Value get_hello(Napi::CallbackInfo const& info) {
  Napi::Env env = info.Env();
  Napi::EscapableHandleScope scope(env);
  return scope.Escape(Napi::String::New(env, "hello"));
}

Napi::Object start(Napi::Env env, Napi::Object exports) {
    exports.Set("hello", Napi::Function::New(env, get_hello));
    return exports;
}

NODE_API_MODULE(app1, start)
