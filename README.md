# Along

Along 是面向兴趣小组的共同探索与协作空间，成员通过个人主页、问答和围绕内容的讨论了解彼此，并自愿开展共同项目。成员可以接入自己的工作 Agent，也可以直接提交材料，由产品帮助整理主页和问答资料；项目参与者及其 Agent 使用已有工具和环境，在授权范围内协作形成不同类型的成果。

当前场景与产品定义见 [兴趣小组场景与产品定义](docs/product-design/product-definition.md)，领域词汇见 [CONTEXT.md](CONTEXT.md)，完整文档导航见 [项目文档](docs/README.md)。架构设计、技术决定与技术选型保留作为参考；被替代的产品文档见 [产品方向归档](docs/archive/2026-10-06-product-direction/README.md)。

仓库已有 S01 身份认证服务，运行配置与既有验收方法见 [身份服务说明](docs/identity/service.md)。[Spec #2](https://github.com/Barytes/oh-share-it/issues/2) 记录此前阶段的实施范围，新产品流程的实施规格需按当前定义重新确定。

[项目开发约束](docs/product-design/project-constraints.md)确定本项目以实现 idea 和积累求职成果为目标，控制持续运营投入，方便用户自行部署，并尽量与通讯产品及 Enterprise AI context 产品保持正交。

开发需要 Node.js 22.22 或更高的受支持 LTS 版本。安装与检查命令：

```sh
npm ci
npm run typecheck
npm run test:identity
npm run build
```
