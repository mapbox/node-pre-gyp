// v8
#include <nan.h>

// node.js
#include <node.h>
#include <node_version.h>

NAN_METHOD(get_hello)
{
  info.GetReturnValue().Set(Nan::New("hello").ToLocalChecked());
}

NAN_MODULE_INIT(init)
{
  Nan::HandleScope scope;
  Nan::Set(target, Nan::New("hello").ToLocalChecked(),
           Nan::GetFunction(Nan::New<v8::FunctionTemplate>(get_hello)).ToLocalChecked());
}

NODE_MODULE(app8, init)
