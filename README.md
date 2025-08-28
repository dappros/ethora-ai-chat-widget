To make assistant work you shoud use

const user = createAnonymousXmppCredentials();

````<ChatAssistant
roomJID={botId}
config={{
          ...assistantChatConfig,
          assistantMode: { enabled: true, user },
        }}
/>```
````
