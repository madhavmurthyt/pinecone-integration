import dotenv from 'dotenv';
dotenv.config();

import ollama from 'ollama';
import pdfParse from 'pdf-parse';
import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs/promises';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
 // environment: process.env.PINECONE_ENVIRONMENT
});

async function createIndex() {
    try {
        console.log("Creating index1...");
        const jsonObject = JSON.parse(JSON.stringify(await pinecone.listIndexes()));

        if (jsonObject && jsonObject.indexes && Array.isArray(jsonObject.indexes)) {
            for (const index of jsonObject.indexes) {
              if (index.name === process.env.PINECONE_INDEX_NAME) {
                console.log(`Index '${process.env.PINECONE_INDEX_NAME}' already exists.`);
                return; // Index already exists, no need to create
              }
            }
          } else {
            console.log("JSON structure is not as expected.");
          }

         await pinecone.createIndex({
            name: process.env.PINECONE_INDEX_NAME,
            dimension: 4096, // Choose based on your embedding model
            metric: 'cosine', // Replace with your model metric
            spec: { 
                serverless: { 
                    cloud: 'aws', 
                    region: 'us-east-1' 
                }
            }
         });
  } catch (error) {
    console.error("Error creating index:", error);
  }
}
  
  

async function processPDF(filePath) {

  createIndex();

  console.log("Processing PDF..."+filePath);
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  const textChunks = data.text.match(/.{1,500}/g); // Break text into chunks

  for (let i = 0; i < textChunks.length; i++) {
    const response = await ollama.embeddings({ model: 'mistral', prompt: textChunks[i] });
    await pinecone.index(process.env.PINECONE_INDEX_NAME).upsert([
      { id: `chunk-${i}`, values: response.embedding, metadata: { text: textChunks[i] } }
    ]);
  }
  console.log("PDF processed & stored in Pinecone!");
}

processPDF("test.pdf");



async function queryRAG(userQuery) {
    const queryEmbedding = await ollama.embeddings({ model: 'mistral', prompt: userQuery });
    const results = await pinecone.index(process.env.PINECONE_INDEX_NAME).query({
      vector: queryEmbedding.embedding,
      topK: 3,
      includeMetadata: true
    });
  
    const context = results.matches.map(match => match.metadata.text).join("\n\n");
    const finalPrompt = `Context: ${context}\n\nUser Query: ${userQuery}`;
  
    const response = await ollama.chat({
      model: 'mistral',
      messages: [{ role: "user", content: finalPrompt }]
    });
  
    console.log("AI Response:", response.message.content);
  }
  
  queryRAG("Does the document talk about AI or does it talk about LLM or LLM with Lang chain?");
  