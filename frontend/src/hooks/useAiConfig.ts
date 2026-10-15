import { useAsyncData } from "./useAsyncData";
import { useCallback } from "react";
import type {
  AiProvider,
  AiChatModel,
  AiChatPrompt,
  CreateAiProviderRequest,
  UpdateAiProviderRequest,
  CreateAiChatModelRequest,
  UpdateAiChatModelRequest,
  CreateAiChatPromptRequest,
  UpdateAiChatPromptRequest,
} from "@/lib/api/aiConfig";
import {
  listAiProviders,
  listAiChatModels,
  listAiChatPrompts,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  createAiChatModel,
  updateAiChatModel,
  deleteAiChatModel,
  createAiChatPrompt,
  updateAiChatPrompt,
  deleteAiChatPrompt,
} from "@/lib/api/aiConfig";


const fetchData = async () => {
  const [providers, models, prompts] = await Promise.all([listAiProviders(), listAiChatModels(), listAiChatPrompts()]);
  return { providers: providers.items, models: models.items, prompts: prompts.items };
};

// 管理 AI 供应商 / 模型 / 提示词 配置的 hook，仅负责数据加载与增删改，不涉及 UI
export const useAiConfig = () => {
  const { state, load } = useAsyncData({ providers: [] as AiProvider[], models: [] as AiChatModel[], prompts: [] as AiChatPrompt[] }, fetchData, "加载 AI 配置失败", true);


  const createProviderAction = useCallback(
    async (input: CreateAiProviderRequest) => {
      await createAiProvider(input);
      await load();
    },
    [load],
  );

  const updateProviderAction = useCallback(
    async (id: number, input: UpdateAiProviderRequest) => {
      await updateAiProvider(id, input);
      await load();
    },
    [load],
  );

  const deleteProviderAction = useCallback(
    async (id: number) => {
      await deleteAiProvider(id);
      await load();
    },
    [load],
  );

  const createModelAction = useCallback(
    async (input: CreateAiChatModelRequest) => {
      await createAiChatModel(input);
      await load();
    },
    [load],
  );

  const updateModelAction = useCallback(
    async (id: number, input: UpdateAiChatModelRequest) => {
      await updateAiChatModel(id, input);
      await load();
    },
    [load],
  );

  const deleteModelAction = useCallback(
    async (id: number) => {
      await deleteAiChatModel(id);
      await load();
    },
    [load],
  );

  const createPromptAction = useCallback(
    async (input: CreateAiChatPromptRequest) => {
      await createAiChatPrompt(input);
      await load();
    },
    [load],
  );

  const updatePromptAction = useCallback(
    async (id: number, input: UpdateAiChatPromptRequest) => {
      await updateAiChatPrompt(id, input);
      await load();
    },
    [load],
  );

  const deletePromptAction = useCallback(
    async (id: number) => {
      await deleteAiChatPrompt(id);
      await load();
    },
    [load],
  );

  return {
    ...state,
    reload: load,
    createProvider: createProviderAction,
    updateProvider: updateProviderAction,
    deleteProvider: deleteProviderAction,
    createModel: createModelAction,
    updateModel: updateModelAction,
    deleteModel: deleteModelAction,
    createPrompt: createPromptAction,
    updatePrompt: updatePromptAction,
    deletePrompt: deletePromptAction,
  };
};
