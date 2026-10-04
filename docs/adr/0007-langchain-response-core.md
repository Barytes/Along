---
status: accepted
---

# 使用 LangChain 构建共用响应核心

2026-10-04 确定在线与本地响应核心采用 TypeScript LangChain createAgent。现成模型与工具循环满足当前资料搜索、读取、转换和回答需要，成员同时希望积累用于求职的 LangChain 实践经验；这是相较于 AI SDK 的本次选择理由。

首版没有必须在 Agent 执行中途按检查点恢复的要求，允许重新执行未完成的查询，产品可靠保存已生成的候选回答、分享检查结果及待确认状态。暂不要求手写 LangGraph 图或持久 Agent 检查点，成员授权、额度与重复提交控制由产品执行。
