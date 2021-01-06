#include <napi.h>
#include <mylib/interface.h>

Napi::Value get_hello(Napi::CallbackInfo const& info) {
  Napi::Env env = info.Env();
  Napi::EscapableHandleScope scope(env);
  MyLib::Message msg("hello");
  std::string msg_string = msg.get();
  return scope.Escape(Napi::String::New(env, msg_string));
}

Napi::Object start(Napi::Env env, Napi::Object exports) {
    exports.Set("hello", Napi::Function::New(env, get_hello));
    return exports;
}

NODE_API_MODULE(app3, start)
