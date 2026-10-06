import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { agentSourceKey } from "./composables/useAgentSource";
import { createAgentSource } from "./services/createAgentSource";
import "./styles/tokens.css";
import "./styles/base.css";

createApp(App).use(createPinia()).provide(agentSourceKey, createAgentSource()).mount("#root");
