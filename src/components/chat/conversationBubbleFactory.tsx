import {BubbleLayout} from '@components/chat/bubbles/bubbleLayout';
import ReplyMarkupLayout from '@components/chat/bubbleParts/replyMarkupLayout';
import ServiceBubbleDescription from '@components/chat/bubbles/serviceBubbleDescription';
import {formatDateAccordingToTodayNew} from '@helpers/date';
import {For, Show} from 'solid-js';
import {render} from 'solid-js/web';

export type ConversationBubbleAction = {
  label: string,
  onClick: () => void
};

type BaseBubbleProps = {
  side: 'left' | 'right' | 'center',
  lines: string[],
  timestamp?: string | null
};

type MessageBubbleProps = BaseBubbleProps & {
  author?: string
};

type ServiceCardProps = BaseBubbleProps & {
  actionRows?: ConversationBubbleAction[][]
};

type ServiceDescriptionCardProps = {
  title: string,
  subtitle?: string | null,
  bullets?: string[]
};

export function mountConversationMessageBubble(props: MessageBubbleProps) {
  const host = document.createElement('div');
  const dispose = render(() => {
    if(props.side === 'center') {
      return (
        <div class="bubble service is-group-first is-group-last">
          <div class="bubble-content-wrapper">
            <div class="bubble-content conversation-service-card">
              <div class="service-msg" style={{'text-align': 'center', 'white-space': 'pre-wrap'}}>
                {props.lines.join('\n')}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <BubbleLayout
        out={props.side === 'right'}
        group="single"
        content={
          <>
            <Show when={props.author}>
              <div class="name floating-part next-is-message" dir="auto">
                {props.author}
              </div>
            </Show>
            <For each={props.lines}>
              {(line) => (
                <div class="message spoilers-container" style={{'white-space': 'pre-wrap'}}>
                  {line}
                </div>
              )}
            </For>
            <Show when={props.timestamp}>
              <div class="time">
                <span class="time-inner">
                  {formatDateAccordingToTodayNew(new Date(props.timestamp!))}
                </span>
              </div>
            </Show>
          </>
        }
      />
    );
  }, host);

  return {
    element: host.firstElementChild as HTMLElement,
    dispose
  };
}

export function mountConversationServiceCard(props: ServiceCardProps) {
  const host = document.createElement('div');
  const dispose = render(() => (
    <div class={`bubble service is-group-first is-group-last${props.actionRows?.length ? ' with-reply-markup' : ''}`}>
      <div class="bubble-content-wrapper">
        <div class="bubble-content conversation-service-card">
          <div class="service-msg" style={{'text-align': 'center', 'white-space': 'pre-wrap'}}>
            {props.lines.join('\n')}
          </div>
        </div>
        <Show when={props.actionRows?.length}>
          <ReplyMarkupLayout>
            <For each={props.actionRows || []}>
              {(row) => (
                <ReplyMarkupLayout.Row>
                  <For each={row}>
                    {(action) => (
                      <ReplyMarkupLayout.Button
                        textClass="reply-markup-suggested-action"
                        onClick={() => action.onClick()}
                      >
                        {action.label}
                      </ReplyMarkupLayout.Button>
                    )}
                  </For>
                </ReplyMarkupLayout.Row>
              )}
            </For>
          </ReplyMarkupLayout>
        </Show>
      </div>
    </div>
  ), host);

  return {
    element: host.firstElementChild as HTMLElement,
    dispose
  };
}

export function mountConversationServiceDescriptionCard(props: ServiceDescriptionCardProps) {
  const host = document.createElement('div');
  const dispose = render(() => (
    <div class="bubble service is-group-first is-group-last">
      <div class="bubble-content-wrapper">
        <div class="bubble-content conversation-service-card">
          <div class="service-msg" style={{'text-align': 'center'}}>
            <ServiceBubbleDescription>
              <ServiceBubbleDescription.Title>
                {props.title}
              </ServiceBubbleDescription.Title>
              <Show when={props.subtitle}>
                <ServiceBubbleDescription.Subtitle>
                  {props.subtitle}
                </ServiceBubbleDescription.Subtitle>
              </Show>
              <Show when={props.bullets?.length}>
                <ServiceBubbleDescription.List type="bullet" each={props.bullets || []}>
                  {(item) => item}
                </ServiceBubbleDescription.List>
              </Show>
            </ServiceBubbleDescription>
          </div>
        </div>
      </div>
    </div>
  ), host);

  return {
    element: host.firstElementChild as HTMLElement,
    dispose
  };
}
