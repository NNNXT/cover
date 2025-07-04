import DirectSource from "../direct-source";
import Setting from "../setting";
import Hash from "hash.js";
import Cache from "../cache";
import Log from "./log";
import ServerCache from "./server-cache";
import CoverHook from "./cover-hook";

class Cover {
    key;
    data;
    cover;
    source;
    preview = $('<img>', { class: 'preview hide' });
    html = $('<td>', { align: 'center', });
    loading = $('<div class="lds-grid"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>');
    hover = {
        element: $('<p>', { class: 'hover-popup' }),
        img: $('<img>', { alt: 'Cover' }),
        top: 0,
        left: 0,
        xOffset: 10,
        yOffset: 15,
        yOffsetPreLoad: 0,
        height: 0,
    };
    auth;

    constructor({ cover, data, auth }) {
        this.cover = cover;
        this.data = data;
        this.auth = auth;
        this.key = Hash.sha1().update(this.cover ?? this.data.id).digest('hex');

        //html
        this.html.attr('bgcolor', this.data.bgColor);

        //except category
        if(this.data.except) {
            Log(this.data.hash, `except category ${this.data.category}`);

            this.preview.attr('src', Setting.previewExcept);
            this.html.append(this.preview);
            this.preview.removeClass('hide');

            //touch progress bar
            this.data.head.touchProgressBar();
        }else{
            //loading
            this.html.append(this.loading);
        }
    }

    async nextTick() {
        if(this.data.except) return;

        if(Setting.serverCache === true){
            if(this.cover && this.auth.isPremium && Cache.detail[this.data.detailId]?.cacheServer !== true) {
                try {
                    new ServerCache().set({ id: this.data.detailId, cover: this.cover, auth: this.auth });
                } catch(e) {
                    Log(this.data.hash, `hook set server cache cover fail!`);
                }
            }

            //server cache for user without premium
            if(this.cover === undefined && this.auth.isPremium === false) {
                const item = ServerCache.items.find(item => item.id === this.data.detailId);
                if(item) {
                    this.cover = item?.cover_base ?? undefined;
                }
            }
        }

        //hook source
        if(this.cover === undefined && this.auth.isPremium === false) {
            Log(this.data.hash, `hooking...`);
            this.cover = await new CoverHook().hook({ data: this.data, auth: this.auth });
            if(this.cover) {
                Log(this.data.hash, `hook cover: ${this.cover}`);
            } else {
                Log(this.data.hash, `hook cover fail!`);
            }
        }


        //except when no cover
        if(this.cover === undefined) {
            Log(this.data.hash, `cover undefined`);
            Log(this.data.hash, `except cover`);

            this.loading.hide();
            this.preview.attr('src', Setting.previewFail);
            this.preview.addClass('no-image');
            this.html.append(this.preview);
            this.preview.removeClass('hide');

            //touch progress bar
            this.data.head.touchProgressBar();
            return;
        }


        this.loadSource().then((source) => {
            this.loading.hide();
            this.preview.attr('src', source);
            this.html.append(this.preview);
            this.preview.show();
            this.previewStyle();

            if(Setting.previewHover === true) this.previewInit(this.preview);
            if(Setting.titleHover === true) this.previewInit(this.data.elements.title);

            //touch progress bar
            this.data.head.touchProgressBar();
        });

        //preview
        this.preview
            .on('error', (e) => {
                e.target.src = Setting.previewFail;
                e.target.className += " no-image"

                Log(this.data.hash, 'load preview fail!');
            })
            .on('load', (e) => {
                Log(this.data.hash, 'load preview success');
                //set cache
                if(Setting.cache && this.source) {
                    Log(this.data.hash, 'source: ' + this.source);

                    Cache.set({
                        key: 'source', data: {
                            key: this.key,
                            value: {
                                source: this.source,
                            }
                        }
                    });

                    Log(this.data.hash, 'save source to cache');
                }
            });

        //hover
        $('body').append(this.hover.element.append(this.hover.img));
    }

    previewStyle() {
        let columnHeight = this.data.td.height();
        if(Setting.previewMaxHeight < columnHeight) {
            let maxHeight = Setting.previewColumnMaxHeight === false ? columnHeight : Setting.previewColumnMaxHeight;
            this.preview.css('max-height', `${maxHeight}px`);
        }
    }

    previewInit(element) {
        //set hover
        element.hover((handlerIn) => {
            Log(this.data.hash, 'hover...');
            this.previewHover(handlerIn);
        }, (handlerOut) => {
            Log(this.data.hash, 'out hover');
            this.previewOutHover(handlerOut);
        });

        //mouse move when hover
        element.mousemove((handler) => {
            this.previewMouseMove(handler);
        });
    }

    previewHover(handlerIn) {
        this.hover.img
            .attr('src', this.source)
            .css('max-height', `${window.innerHeight * 0.6}px`)
            .on('load', () => {
                this.hover.height = $(this.hover.img).height() + 10;
            });

        this.hover.top = handlerIn.pageY - this.hover.xOffset;
        this.hover.left = handlerIn.pageX + this.hover.yOffset;
        this.hover.yOffsetPreLoad = (window.innerHeight - handlerIn.clientY) < 0 ? (window.innerHeight - handlerIn.clientY) - 10 : 0;

        this.hover.element.css({
            top: `${this.hover.top}px`,
            left: `${this.hover.left}px`,
        });

        this.hover.element.show();
    }

    previewOutHover(handlerOut) {
        this.hover.top = handlerOut.pageY - this.hover.xOffset;
        this.hover.element.hide();
    }

    previewMouseMove(handler) {
        let y = handler.clientY < this.hover.height ? this.hover.yOffsetPreLoad + this.hover.height - handler.clientY : 20;
        let top = handler.pageY - this.hover.xOffset + this.hover.yOffsetPreLoad - this.hover.height + y;
        let left = handler.pageX + this.hover.yOffset;
        this.hover.element.css({
            top: `${top}px`,
            left: `${left}px`,
        });
    }

    async loadSource() {
        return await new Promise(resolve => {
            //Load cache
            if(Cache.source[this.key]) {
                this.source = Cache.source[this.key].source;

                Log(this.data.hash, 'load source form cache');
                resolve(this.source);
            }

            new DirectSource.DirectSource(DirectSource.domains, DirectSource.patterns).get(this.cover).then(link => {
                Log(this.data.hash, 'load source cover: ' + this.cover);
                Log(this.data.hash, 'load source: ' + link);

                this.source = link;

                resolve(this.source);
            });
        });
    }

}

export default Cover;
