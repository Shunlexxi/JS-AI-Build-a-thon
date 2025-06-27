import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({ 
    model: "gpt-4",
    apiKey: "Bjw05CZshvAKo5ioocRrkqMUQ8aV0Z8b8JUf9nOb3mzxuCyhQ0tIJQQJ99BFACrIdLPXJ3w3AAAAACOGpnre"
});

import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const messages = [
  new SystemMessage("Translate the following from English into Italian"),
  new HumanMessage("hi!"),
];

await model.invoke(messages);



