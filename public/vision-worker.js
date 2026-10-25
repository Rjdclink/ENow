import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
env.allowLocalModels=false;
env.backends.onnx.wasm.numThreads=1;
self.onmessage=async event=>{
  try{const captioner=await pipeline('image-to-text','Xenova/vit-gpt2-image-captioning',{dtype:'q8',device:'wasm'});const result=await captioner(event.data.image,{max_new_tokens:35});self.postMessage({type:'result',caption:result[0]?.generated_text||''});}
  catch{self.postMessage({type:'error',error:'On-device photo recognition unavailable'});}
};
