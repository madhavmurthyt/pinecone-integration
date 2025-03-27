import ollama from 'ollama';

async function runModel() {
  const response = await ollama.chat({
    model: 'my-custom-mistral', 
    messages: [{ role: 'user', content: 'How can I use LLMs in Node.js?' }]
  });
  console.log(response.message.content);
}

runModel();
