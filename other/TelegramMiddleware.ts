import adze, { ModifierData, ModifierName } from 'adze';
import Log, { Middleware } from 'adze';
import { Bot } from 'grammy';

export class TelegramMiddleware extends Middleware {
  constructor(private bot: Bot) {
    super('both');
    // adze.info('telegram middleware enabled');
    console.log('constructor')
  }

  constructed(log: adze): void {
    //   console.log('constructed', log)
  }

  protected async loadServerDependencies() {
    console.log('loadServerDependencies')
  }
  
  protected async loadBrowserDependencies() {
    console.log('loadServerDependencies2')
  }

  afterModifierApplied(log: adze, name: ModifierName, data: ModifierData): void {
      console.log('afterModifierApplied', log.data)
  }

  beforeModifierApplied(log: adze, name: ModifierName, data: ModifierData): void {
    console.log('beforeModifierApplied', log.data)
  }  

  
  beforeFormatApplied(log: Log, format: string, message: unknown[]): void {
    console.log('beforeFormatApplied', message)
    const VANJA_CHAT_ID = 7502414131;

    // const chatId = 'your_chat_id';
    this.bot.api.sendMessage(VANJA_CHAT_ID, JSON.stringify(message))
    //   .then(() => console.log('Log sent to Telegram'))
      .catch((err) => console.error('Error sending log to Telegram:', err));
  }

  afterFormatApplied(log: Log, format: string, message: unknown[]): void {
    console.log('afterFormatApplied', message)
  }
}