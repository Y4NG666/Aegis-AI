# Aegis AI Guardian

3 分钟黑客松 Demo 演示文稿

## Slide 1 - Title

标题：

`Aegis AI Guardian`

副标题：

`AI-driven on-chain defense for DeFi risk events`

台词，20 秒：

大家好，我们的项目叫 Aegis AI Guardian。  
它解决的问题很直接：DeFi 协议在遭遇异常流动性变化、MEV、或者潜在攻击时，传统告警只能告诉你“出问题了”，但不能自动防御。  
我们做的是一套从前端、后端、AI 到智能合约的完整闭环系统，让风险被发现后，能够直接触发链上防御动作。

## Slide 2 - Problem

标题：

`Problem: Alerts Are Too Slow`

页面要点：

- DeFi attacks spread in seconds
- Monitoring tools detect, but do not act
- Manual response is too slow
- Protocols need automated, on-chain defense

台词，25 秒：

现在很多 Web3 安全产品只能做监控和告警。  
但真正的问题是，攻击不是按分钟发生的，而是按区块发生的。  
如果团队还要等人看 dashboard、判断风险、再手动暂停协议，往往已经来不及了。  
所以我们的核心价值是，把“发现风险”升级成“发现后立刻执行防御”。

## Slide 3 - Solution

标题：

`Solution: AI + Smart Contracts + Real-Time UI`

页面要点：

`Frontend -> Wallet -> Backend API -> Smart Contract -> Event -> AI -> Contract Execution -> Frontend Update`

台词，30 秒：

我们的系统是一个闭环。  
前端连接钱包并调用后端 API。  
后端通过 Web3.py 监听合约事件，把事件送进 AI 风险检测模块。  
AI 算出风险分数后，再通过策略引擎决定是继续观察、对冲，还是直接暂停协议。  
最后，防御结果会重新写回合约和前端界面，所以用户能实时看到风险分数和协议状态变化。

## Slide 4 - Architecture

标题：

`How It Works`

页面要点：

- React + ethers.js: wallet connection and live dashboard
- FastAPI: orchestration layer
- Web3.py: contract reads, writes, event listener
- AI engine: anomaly detection + strategy decision
- Smart contracts: guardian state + risk controller

台词，30 秒：

技术上，前端用 React 和 ethers.js，负责钱包连接和实时状态展示。  
后端是 FastAPI，作为控制平面。  
Web3.py 负责读写智能合约和监听事件。  
AI 部分由 anomaly detection 和 strategy engine 两层组成。  
链上则有两个核心合约：一个记录 AI 风险状态，一个负责真正执行 pause 这样的防御动作。

## Slide 5 - Live Demo

标题：

`Live Demo: Simulate Attack`

页面要点：

1. Connect Wallet  
2. Click `Simulate Attack`  
3. Backend triggers abnormal liquidity event  
4. AI computes risk score  
5. Strategy engine decides `pause`  
6. UI updates to `ATTACK` and protocol becomes `PAUSED`

台词，60 秒：

现在我现场演示一次。  
首先连接钱包。  
然后点击 `Simulate Attack`。  
这一步会调用后端的 `/trigger-attack`，后端会向已部署的监控合约写入一组异常流动性数据。  
监听器接收到 `AbnormalLiquidityDetected` 事件后，会触发 AI 引擎。  
AI 会计算风险分数，然后策略引擎决定是否需要暂停协议。  
在我们当前的演示环境里，这次攻击事件会把 risk score 提升到 55，并触发 `pause`。  
接着前端每 3 秒轮询一次 `/status`，所以你会看到页面从 SAFE 变成 ATTACK，协议状态从 LIVE 变成 PAUSED。

## Slide 6 - What Makes This Special

标题：

`Why This Matters`

页面要点：

- Not just monitoring, but autonomous defense
- End-to-end integration already working
- Modular stack, easy to extend to more risk models
- Can support production security workflows

台词，25 秒：

这个项目最重要的不是单个模型，而是闭环能力。  
我们不是只做一个静态 dashboard，也不是只做一个合约 demo。  
我们已经把钱包、前端、后端、AI、事件监听和链上执行真正接在一起。  
而且整个架构是模块化的，后续可以继续扩展更多风险模型、更多防御策略，甚至接入真实协议场景。

## Slide 7 - Closing

标题：

`Aegis AI Guardian`

副标题：

`From detection to autonomous on-chain protection`

台词，20 秒：

总结一下，Aegis AI Guardian 让 DeFi 协议从“被动告警”升级为“主动防御”。  
它把 AI 风险判断直接转化成链上可执行动作，并实时反馈给用户界面。  
谢谢大家，我们很期待把这套能力继续扩展到更多真实的 Web3 安全场景。

## Live Demo Click Path

现场建议按这个顺序操作：

1. 打开首页 Dashboard
2. 点击 `Connect Wallet`
3. 指一下当前 `SAFE / LIVE` 状态
4. 点击 `Simulate Attack`
5. 等待 3 到 10 秒
6. 指一下 `RISK SCORE`、`ATTACK`、`PAUSED`
7. 展示日志里的 `Decision` 和 `Transaction hash`

## 备用一句话 Pitch

`Aegis AI Guardian is an autonomous DeFi defense system that detects abnormal on-chain behavior, lets AI score the risk, and executes smart-contract protection in real time.`

## 评委可能会问的 3 个问题

### Q1. 你们和普通告警平台有什么区别？

我们不是只做检测，而是把检测、决策、执行三段真正串起来，能直接把风险结果转成链上动作。

### Q2. AI 会不会误判？

会，所以我们把 AI 放在策略引擎之前，并保留 modular 的 risk rules、可解释 reasons、以及链上 guardian state，方便进一步加人工阈值或多模型投票。

### Q3. 这个能扩展到真实协议吗？

可以。现在的 demo 已经覆盖钱包、后端、合约、事件监听、AI 和 UI 更新。下一步只需要接入更多真实协议事件源和更成熟的策略配置。
