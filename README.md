# Ticket Link Verifier Action

此 GitHub Action 验证拉取请求(PR)中是否包含有效的工单链接，确保每个 PR 都与已跟踪的任务或问题相关联。

## 工作原理

1. 扫描 PR 描述中的工单链接，格式为：`<BASE_URL>/projects/<project_id>/tickets/<ticket_id>`
2. 通过调用工单系统的 API 来验证工单是否存在
3. 对不包含有效工单链接的 PR 进行评论提醒

## 设置

### 1. 创建工作流文件

在您的仓库中创建名为 `.github/workflows/ticket-verification.yml` 的文件，内容如下：

```yaml
name: PR ticket verification

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

jobs:
  verify-ticket:
    runs-on: ubuntu-latest
    steps:
      - name: verify ticket link
        uses: your-org/pr-ticket-verifier@v1.0.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          BASE_URL: "https://guild.adventurer.tech"
          API_URL: "https://api.adventurer.tech"
          API_KEY: ${{ secrets.API_KEY }} # 可选
        with:
          message: "请添加 ticket 链接!"
```

### 3. 自定义消息（可选）

您可以使用 `message` 输入参数自定义发布在缺少工单链接的 PR 上的评论。

## PR 描述格式示例

要通过工单验证，请在 PR 描述中包含符合以下模式的链接：

```
<BASE_URL>/projects/123/tickets/456
```

其中 `123` 是项目 ID，`456` 是工单 ID。

## 高级配置

### 自定义 API 集成

该 Action 通过向 `<API_URL?/api/projects/<project_id>/tickets/<ticket_id>` 发送 GET 请求来验证工单。
如果您的 API 需要自定义标头或不同路径，您需要修改源代码。

### 多工单系统

如果您使用多个工单系统，可以使用不同配置部署多个此 Action 实例。
