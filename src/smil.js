window.smil = window.smil || {};


smil.Timer = function(opts)
{
    var proto = {
        init: function (opts) {
            var opts = $.extend({
                duration: 0,
                repeatCount: 1,
            }, opts);

            this.duration = opts.duration;
            this.currentTime = 0;
            this.repeatCount = opts.repeatCount;
            this.rate = 40;

            return this;
        },
        play: function (cb) {
            console.log('play');
            if (! this.intervalId) {
                this.paused = false;
                this.start = new Date().getTime() - (this.currentTime * 1000);
                this.intervalId = window.setInterval((function () {
                    var now = new Date();
                    var nextTime = (now - this.start) / 1000;
                    if (nextTime > this.duration) {
                        if (this.repeatCount == 'indefinite') {
                            this.currentTime = nextTime % this.duration;
                        } else {
                            this.currentTime = 0;   
                            this.pause(); 
                        };
                    } else {
                        this.currentTime = nextTime;
                    };

                    cb();
                }).bind(this), this.rate);
            }
        },
        pause: function () {
            console.log('pause');
            window.clearInterval(this.intervalId);
            this.paused = true;
        },
        stop: function () {
            console.log('stop');
            window.clearInterval(this.intervalId);
            this.currentTime = 0;
        }
    };
    
    return Object.create(proto).init(opts);
};

smil.Seq = function(elt)
{
    var proto = {
        init: function (elt) {
            this.$elt = $(elt);
            this.repeatCount = this.$elt.data('repeatcount');
            this.timeNodes = [];

            this.parseTimeNodes();

            return this;
        },
        parseTimeNodes: function () {
            var children = this.$elt.children('[data-dur]');
            var timeIn = 0;
            var timeOut = 0;
            var that = this;

            children.each(function (i) {
                timeOut = timeIn + parseFloat($(this).data('dur'));
                that.timeNodes.push({timeIn: timeIn, timeOut: timeOut, elt: $(this)});
                timeIn = timeOut;

                children.attr('smil', 'idle')
            });

            this.timer = smil.Timer({duration: timeOut, repeatCount: this.repeatCount});
            
            var cb = function () {
                var currentTime = that.timer.currentTime;
                $.each(that.timeNodes, function(i) {
                    if (that.timeNodes[i].timeIn <= currentTime && that.timeNodes[i].timeOut > currentTime) {
                        that.timeNodes[i].elt.attr('smil', 'active');
                    } else {
                        that.timeNodes[i].elt.attr('smil', 'idle');
                    };
                });
            };

            this.timer.play(cb);
        },
    };
    
    return Object.create(proto).init(elt);
};


$(function() {
    $("[data-timecontainer]").each(function (i) {
         smil.Seq(this); 
    });

    //timer = smil.Timer().play()
});
