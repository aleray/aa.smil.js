// # License
//
// Copyright 2013 Alexandre Leray <http://stdin.fr/>
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
// 
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
// Also add information on how to contact you by electronic and paper mail.



// Our code will live in the `SMIL` namespace, so we create this namespace if
// it doesn't exist yet.
window.SMIL = window.SMIL || {};


// # Ready States

// no information whether or not the audio/video is ready
SMIL.HAVE_NOTHING = 0
// metadata for the audio/video is ready
SMIL.HAVE_METADATA = 1
// data for the current playback position is available, but not enough data to play next frame/millisecond
SMIL.HAVE_CURRENT_DATA = 2
// data for the current and at least the next frame is available
SMIL.HAVE_FUTURE_DATA = 3
// enough data available to start playing
SMIL.HAVE_ENOUGH_DATA = 4


// SMIL.Timer is a simple 
SMIL.Timer = function(opts) {
    var proto = {
        init: function (opts) {
            var opts = $.extend({
                duration: 0,
                repeatCount: 1,
                callback: $.noop,
            }, opts);

            this.duration = opts.duration;
            this.currentTime = 0;
            this.repeatCount = opts.repeatCount;
            this.rate = 40;
            this.callback = opts.callback;
            this.intervalId;

            return this;
        },
        play: function (callback) {
            console.log('play');
            if (this.intervalId === undefined) {
                this.paused = false;
                this.start = $.now() - (this.currentTime * 1000);
                this.intervalId = window.setInterval((function () {
                    var nextTime = ($.now() - this.start) / 1000;
                    if (nextTime > this.duration) {
                        if (this.repeatCount == 'indefinite') {
                            this.currentTime = nextTime % this.duration;
                        } else {
                            this.stop()
                        };
                    } else {
                        this.currentTime = nextTime;
                    };

                    this.callback();
                }).bind(this), this.rate);
            }
        },
        pause: function () {
            console.log('pause');
            this.intervalId = window.clearInterval(this.intervalId);
            this.paused = true;
        },
        stop: function () {
            this.pause();
            this.currentTime = 0;
        }
    };
    
    return Object.create(proto).init(opts);
};

SMIL.Seq = function(elt) {
    var proto = {
        init: function (elt) {
            this.$elt = $(elt);
            this.repeatCount = this.$elt.data('repeatcount') || 'indefinite';
            this.timeNodes = [];

            this.parseTimeNodes();

            return this;
        },
        parseTimeNodes: function () {
            var children = this.$elt.children('[data-dur], audio, video');
            var timeIn = 0;
            var timeOut = 0;
            var that = this;

            children.each(function (i) {
                if (/AUDIO|VIDEO/.test(this.tagName)) {
                    timeOut = timeIn + $(this).prop('duration');
                } else {
                    timeOut = timeIn + parseFloat($(this).data('dur'));
                };

                that.timeNodes.push({timeIn: timeIn, timeOut: timeOut, elt: $(this), tagName: this.tagName});
                timeIn = timeOut;

                children.attr('smil', 'idle')
            });

            var callback = function () {
                var currentTime = that.timer.currentTime;
                $.each(that.timeNodes, function(i) {
                    var timeNode = that.timeNodes[i];

                    // The following if/else block tests if the timenodes are active or not
                    if (timeNode.timeIn <= currentTime && timeNode.timeOut > currentTime) {

                        // If the time node is an audio or video tag, we want to play it
                        if (/AUDIO|VIDEO/.test(timeNode.tagName)) {
                            var elt = timeNode.elt.get(0);

                            if (elt.paused) {
                                elt.play();
                                elt.currentTime = currentTime - timeNode.timeIn;
                            } else {
                                var eltCurrentTime = elt.currentTime;
                                var newTime = currentTime - timeNode.timeIn;

                                // To avoid the desynchronization of the master
                                // clock and the audio/video tag (due to, for
                                // instance, network latency), we
                                // re-synchronize the audio/video current time
                                // on the master clock, if the delta is
                                // superior to 250 ms
                                if (eltCurrentTime < (newTime - 0.250) ||
                                        elt.CurrentTime > (newTime + 0.250)) {
                                    elt.currentTime = currentTime - timeNode.timeIn;
                                };
                            };
                        };

                        // If the 'active' attribute isn't set yet, sets it and
                        // trigger an 'active' event
                        if (timeNode.elt.attr('smil') !== 'active') {
                            timeNode.elt.attr('smil', 'active');
                            timeNode.elt.trigger('active'); 
                        };
                    } else {
                        if (/AUDIO|VIDEO/.test(timeNode.tagName)) {
                            timeNode.elt.get(0).pause();
                        };

                        timeNode.elt.attr('smil', 'idle');
                    };
                });

                that.$elt.trigger('timeupdate');
            };

            if (this.timer) {
                console.log('stopping');
                this.timer.stop();
                this.timer.init({duration: timeOut, repeatCount: this.repeatCount, callback: callback});
            } else {
                this.timer = SMIL.Timer({duration: timeOut, repeatCount: this.repeatCount, callback: callback});
            };
            this.$elt.data('timer', this.timer);

            this.$elt.trigger('smilready');

            this.timer.play();
        }
    };
    
    return Object.create(proto).init(elt);
};


SMIL.Par = function(elt) {
    var proto = {
        init: function (elt) {
            this.$elt = $(elt);
            this.repeatCount = this.$elt.data('repeatcount') || 'indefinite';
            this.mediasync = this.$elt.data('mediasync') || null;
            this.timeNodes = [];

            this.parseTimeNodes();

            return this;
        },
        parseTimeNodes: function () {
            var children = this.$elt.children('[data-begin]');
            var that = this;
            var maxTimeOut = 0;

            children.each(function (i) {
                var timeIn = parseFloat($(this).data('begin'));
                var timeOut = parseFloat($(this).data('end'));

                that.timeNodes.push({timeIn: timeIn, timeOut: timeOut, elt: $(this), tagName: this.tagName});

                if (timeOut > maxTimeOut) {
                    maxTimeOut = timeOut;
                }

                children.attr('smil', 'idle')
            });

            var callback = function () {
                var currentTime = that.timer.currentTime;
                $.each(that.timeNodes, function(i) {
                    var timeNode = that.timeNodes[i];

                    // The following if/else block tests if the timenodes are active or not
                    if (timeNode.timeIn <= currentTime && timeNode.timeOut > currentTime) {

                        // If the time node is an audio or video tag, we want to play it
                        if (/AUDIO|VIDEO/.test(timeNode.tagName)) {
                            var elt = timeNode.elt.get(0);

                            if (elt.paused) {
                                elt.play();
                                elt.currentTime = currentTime - timeNode.timeIn;
                            } else {
                                var eltCurrentTime = elt.currentTime;
                                var newTime = currentTime - timeNode.timeIn;

                                // To avoid the desynchronization of the master
                                // clock and the audio/video tag (due to, for
                                // instance, network latency), we
                                // re-synchronize the audio/video current time
                                // on the master clock, if the delta is
                                // superior to 250 ms
                                if (eltCurrentTime < (newTime - 0.250) ||
                                        elt.CurrentTime > (newTime + 0.250)) {
                                    elt.currentTime = currentTime - timeNode.timeIn;
                                };
                            };
                        };

                        // If the 'active' attribute isn't set yet, sets it and
                        // trigger an 'active' event
                        if (timeNode.elt.attr('smil') !== 'active') {
                            timeNode.elt.attr('smil', 'active');
                            timeNode.elt.trigger('active'); 
                        };
                    } else {
                        if (/AUDIO|VIDEO/.test(timeNode.tagName)) {
                            timeNode.elt.get(0).pause();
                        };

                        timeNode.elt.attr('smil', 'idle');
                    };
                });

                that.$elt.trigger('timeupdate');
            };

            if (this.mediasync) {
                $(this.mediasync).bind('timeupdate', function() {

                    var currentTime = this.currentTime;
                    $.each(that.timeNodes, function(i) {
                        var timeNode = that.timeNodes[i];

                        // The following if/else block tests if the timenodes are active or not
                        if (timeNode.timeIn <= currentTime && timeNode.timeOut > currentTime) {

                            // If the time node is an audio or video tag, we want to play it
                            if (/AUDIO|VIDEO/.test(timeNode.tagName)) {
                                var elt = timeNode.elt.get(0);

                                if (elt.paused) {
                                    elt.play();
                                    elt.currentTime = currentTime - timeNode.timeIn;
                                } else {
                                    var eltCurrentTime = elt.currentTime;
                                    var newTime = currentTime - timeNode.timeIn;

                                    // To avoid the desynchronization of the master
                                    // clock and the audio/video tag (due to, for
                                    // instance, network latency), we
                                    // re-synchronize the audio/video current time
                                    // on the master clock, if the delta is
                                    // superior to 250 ms
                                    if (eltCurrentTime < (newTime - 0.250) ||
                                            elt.CurrentTime > (newTime + 0.250)) {
                                        elt.currentTime = currentTime - timeNode.timeIn;
                                    };
                                };
                            };

                            // If the 'active' attribute isn't set yet, sets it and
                            // trigger an 'active' event
                            if (timeNode.elt.attr('smil') !== 'active') {
                                timeNode.elt.attr('smil', 'active');
                                timeNode.elt.trigger('active'); 
                            };
                        } else {
                            if (/AUDIO|VIDEO/.test(timeNode.tagName)) {
                                timeNode.elt.get(0).pause();
                            };

                            timeNode.elt.attr('smil', 'idle');
                        };
                    });

                    
                });;
            } else {;
                if (this.timer) {
                    console.log('stopping');
                    this.timer.stop();
                    this.timer.init({duration: maxTimeOut, repeatCount: this.repeatCount, callback: callback});
                } else {
                    this.timer = SMIL.Timer({duration: maxTimeOut, repeatCount: this.repeatCount, callback: callback});
                };

                this.$elt.data('timer', this.timer);

                this.$elt.trigger('smilready');

                this.timer.play();
            }
        }
    };

    return Object.create(proto).init(elt);
}


SMIL.registry = [];


// This function selects all the time containers and bootstraps them 
SMIL.parseTimeContainers = function () {
    // In case SMIL.parseTimeContainers is called several times, we need to
    // make sure that we accuratly destroy the previous SMI.Seq elements and
    // their associated timers, otherwise they will continue to exist.
    $.each(SMIL.registry, function(i) {
        SMIL.registry[i].timer.stop();
        SMIL.registry = [];
    });

    // Now we go over all the time container elements and we create the
    // appropriate SMIL object (at the moment, only SMIL.seq is supported)
    $("[data-timecontainer]").each(function (i) {
        var type = $(this).data('timecontainer'); 

        if (type === 'seq') {
            // We keep a trace of the newly created object to be able to
            // destroy it afterward (especially the associated timer which
            // otherwise keep running)
            SMIL.registry.push(SMIL.Seq(this)); 
        } else if (type === 'par') {
            SMIL.registry.push(SMIL.Par(this)); 
        } else if (type === 'excl') {
            console.warn('Wrong or missing timecontainer value');
        } else {
            console.warn('Wrong or missing timecontainer value');
        };
    });
};


SMIL.destroy = function () {
    $.each(SMIL.registry, function(i) {
        SMIL.registry[i].destroy();
    });
}


SMIL.init = function () {
    // There are 2 kinds of timenodes: any HTML element with [data-dur]
    // attribute, and audio or video tags. The later doesn't need a [data-dur]
    // attribute because their duration is given by their media.
    //
    // However before parsing the timenodes, we need to make sure that we can
    // compute the duration of the media elements on the page; that is when
    // metadata is loaded.
    var mediaElements = $('audio, video').filter(function(i) { return this.readyState < 1 });
    var mediaElementsCount = mediaElements.length;
    var mediaElementsLoadedCount = 0;

    if (mediaElements.length) {
        mediaElements.one('loadedmetadata', function() {
            mediaElementsLoadedCount++;

            if (mediaElementsLoadedCount == mediaElementsCount) {
                SMIL.parseTimeContainers();
            };
        });
    } else {
        SMIL.parseTimeContainers();
    };
};


// So here we go for the firework. The code below is trigger when the DOM is ready
$(function() {
    SMIL.init();
});

// vim: set foldmethod=indent :
