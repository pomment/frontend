import './sass/frontend.scss';
import Pomment from 'pomment-sdk';
import Main from './compoments/index.eft';
import Bar from './compoments/bar/main';
import Form from './compoments/form/main';
import UIStrings from './strings/content';
import Comment from './compoments/comment/comment.eft';
import Config from './config';
import makeTree from './tree';
import timeSince from './utils/time';
import replaceUIString from './strings/replace';

class PommentWidget extends Main {
    constructor(props) {
        super(props);
        this.avatarPrefix = props.avatarPrefix || 'https://secure.gravatar.com/avatar/';
        this.fixedHeight = props.fixedHeight || 0;
        this._loaded = false;
        this._threadData = {};
        this._threadElementMap = new Map();
        this._threadMap = new Map();
        this._sdk = new Pomment({
            server: props.server,
            defaultURL: props.url,
            defaultTitle: props.title,
        });
        this._currentTarget = -1;
        Object.keys(this).forEach((e) => {
            Object.defineProperty(this, e, {
                enumerable: false,
            });
        });
    }

    async load() {
        if (this._loaded) {
            throw Error('This instance is already loaded');
        }
        try {
            this._headerMessage = new Bar({
                $data: {
                    style: 'info',
                    message: UIStrings.POMMENT_LOADING,
                },
            });
            const rawThreadData = await this._sdk.listComments();
            this._loaded = true;
            this._form = new Form({
                root: this,
            });
            this._defaultForm = this._form;
            this._headerMessage = null;
            // 可变高度文本框初始化
            this._form.area.value = '\n\n\n\n';
            this._form.minHeight = this._form.area.getBoundingClientRect().height;
            this._form.area.style.height = `${this._form.minHeight}px`;
            this._form.area.value = '';
            this._threadData = makeTree(rawThreadData.content);
            this._printList();
        } catch (e) {
            this._headerMessage = new Bar({
                $data: {
                    style: 'error',
                    message: UIStrings.POMMENT_LOADING_FAILED,
                    link: UIStrings.POMMENT_LOADING_RETRY,
                },
                $methods: {
                    link: this.load.bind(this),
                },
            });
            throw e;
        }
    }

    _printList() {
        this._comments = [];
        const avatarSize = Config.avatarSize;
        this._threadData.forEach((e) => {
            const singleItem = new Comment({
                $methods: {
                    jump: this._jumpTo.bind(this),
                    reply: this._moveFormTo.bind(this),
                },
                $data: {
                    id: e.id,
                    name: e.name,
                    emailHashed: `${this.avatarPrefix + e.emailHashed}?s=${avatarSize}`,
                    content: e.content,
                    datetime: e.createdAt.toISOString(),
                    date: timeSince(e.createdAt),
                    reply: UIStrings.ENTRY_REPLY,
                },
            });
            this._threadMap.set(e.id, e);
            this._threadElementMap.set(e.id, singleItem);
            this._comments.push(singleItem);
            if (e.sub) {
                e.sub.forEach((f) => {
                    const subSingleItem = new Comment({
                        $methods: {
                            jump: this._jumpTo.bind(this),
                            reply: this._moveFormTo.bind(this),
                        },
                        $data: {
                            id: f.id,
                            name: f.name,
                            emailHashed: `${this.avatarPrefix + f.emailHashed}?s=${avatarSize}`,
                            content: f.content,
                            datetime: f.createdAt.toISOString(),
                            date: timeSince(f.createdAt),
                            parent: f.parent,
                            reply: UIStrings.ENTRY_REPLY,
                            replyOf: replaceUIString(UIStrings.ENTRY_REPLY_OF, {
                                parentName: this._threadMap.get(f.parent).name,
                            }),
                            replyOfPaddingLeft: UIStrings.ENTRY_PRPLY_OF_PADDING,
                        },
                    });
                    this._threadMap.set(f.id, f);
                    this._threadElementMap.set(f.id, subSingleItem);
                    singleItem.subComments.push(subSingleItem);
                });
            }
        });
    }

    _jumpTo(props) {
        const id = props.value;
        const element = this._threadElementMap.get(id).$ctx.nodeInfo.element;
        window.scrollTo({
            top: element.offsetTop - this.fixedHeight,
            behavior: 'smooth',
        });
    }

    _moveFormTo(props) {
        this._form.$umount();
        if (props.id < 0) {
            if (process.env.NODE_ENV !== 'production') {
                console.info('[Pomment]', 'Form will be moved to default position');
            }
            this._currentTarget = -1;
            this._defaultForm = this._form;
            return;
        }
        const id = props.value;
        if (process.env.NODE_ENV !== 'production') {
            console.info('[Pomment]', `Form will be moved to the bottom of ${id}`);
        }
        this._currentTarget = id;
        const element = this._threadElementMap.get(id);
        element.form = this._form;
    }

    get loaded() {
        return this._loaded;
    }
}

export default PommentWidget;
