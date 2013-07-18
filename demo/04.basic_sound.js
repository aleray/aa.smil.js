$(function() {
    var slider = $("#slider").slider();
    var time = $('#currentTime');

    $('#playlist').on('smilready', function (event) {
        var duration = $(this).data('timer').duration;
        var that = this;

        slider.slider('option', 'max', duration);
        slider.slider('option', 'start', function(event, ui) {
            $(that).data('timer').pause();
        });
        slider.slider('option', 'stop', function(event, ui) {
            $(that).data('timer').currentTime = ui.value;
            $(that).data('timer').play();
        });
    }).on('timeupdate', function (event) {
        var currentTime = $(this).data('timer').currentTime;
        var duration = $(this).data('timer').duration;
        time.text(currentTime.secondsTo('hh:mm:ss') + ' / ' + duration.secondsTo('hh:mm:ss'));
        slider.slider('option', 'value', currentTime);
    });

    $('#add').on('click', function (event) {
        var src = 'http://sound.constantvzw.org/PublicDomainDay/02_public_domain_day_neel_doff_compr.ogg';
        var audio = $('<audio>').attr({controls: '', src: src});
        $('#playlist').prepend(audio);
        SMIL.init();
    });

    $('#play').on('click', function (event) {
        $.each(SMIL.registry, function(i) {
            this.timer.play();
        });
    });

    $('#pause').on('click', function (event) {
        $.each(SMIL.registry, function(i) {
            this.timer.pause();   
        });
    });
});
