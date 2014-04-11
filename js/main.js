var FADE_ANIMATION_MS = 200;
var SHOW_CHOICE_ANIMATION_MS = 100;

function showChoice(selector) {
    $(selector).addClass('show');
    $(selector).parent().addClass('show');
    $(selector).parent().find('.mediaSelectIcon').addClass('show');
    $(selector).parent().find('.mediaSelectName').addClass('show');
}

function showChoices() {
    var count = 0;
    var intervalId = setInterval(function() {
        if (count === 0) {
            showChoice('.games');
        } else if (count == 1) {
            showChoice('.movies');
        } else if (count == 2) {
            showChoice('.books');

            clearInterval(intervalId);
        }

        count++;
    }, SHOW_CHOICE_ANIMATION_MS);
}

function hideMediaSelect(displaySearch) {
    displaySearch = (typeof(displaySearch) == 'undefined') ? true : false;

    $('#mediaSelectContainer').animate(
        {
            opacity: 0
        },
        FADE_ANIMATION_MS,
        function() {
            $(this).hide();

            if (displaySearch) {
                showSearch();
            }
        }
    );
}

function showMediaSelect() {
    $('#mediaSelectContainer').show();
    $('#mediaSelectContainer').animate(
        {
            opacity: 1
        },
        FADE_ANIMATION_MS
    );
}

function showSuggestions() {
    $('#suggestionContainer').show();
    $('.back').height($('.front').height());
    $('#suggestionContainer').animate(
        {
            opacity: 1
        }, FADE_ANIMATION_MS
    );
}

function hideSuggestions() {
    $('#suggestionContainer').animate(
        {
            opacity: 0
        },
        FADE_ANIMATION_MS,
        function() {
            $(this).hide();
        }
    );
}

function hideSearch(showSuggestion) {
    showSuggestion = (typeof(showSuggestion) == 'undefined') ? true : false;

    $('#searchContainer').animate(
        {
            opacity: 0
        },
        FADE_ANIMATION_MS,
        function() {
            $(this).hide();

            if (showSuggestion) {
                showSuggestions();
            }
        }
    );
}

function showSearch() {
    $('#searchContainer').show();
    $('#searchContainer').animate(
        {
            opacity: 1
        },
        FADE_ANIMATION_MS
    );
}

$(document).ready(function() {
    showChoices();

    $('.mediaSelectInner').click(function() {
        var thisDiv = $(this);
        thisDiv.addClass('shrink');
        thisDiv.parent().addClass('shrink');
        thisDiv.parent().find('.mediaSelectIcon').addClass('shrink');
        thisDiv.parent().find('.mediaSelectName').addClass('shrink');

        var shrinkIntervalId = setInterval(function() {
            thisDiv.removeClass('shrink');
            thisDiv.parent().removeClass('shrink');
            thisDiv.parent().find('.mediaSelectIcon').removeClass('shrink');
            thisDiv.parent().find('.mediaSelectName').removeClass('shrink');
            hideMediaSelect();
            clearInterval(shrinkIntervalId);
        }, 50);
    });

    $('#searchButton').click(function() {
        hideSearch();
    });

    $('#search').keydown(function (e){
        if(e.keyCode == 13){
            hideSearch();
        }
    });

    $('.back').height($('.front').height());

    $(window).resize(function() {
        $('.back').height($('.front').height());
    });

    var flipped = false;

    $('.flip-container .flipper').click(function() {
        if ($(this).hasClass('flip')) {
            $(this).removeClass('flip');
        } else if (!$(this).hasClass('flip') && $(this).hasClass('backPeek')) {
            $(this).removeClass('backPeek');
        } else if (!$(this).hasClass('flip')) {
            $(this).addClass('flip');
        }

        $(this).removeClass('frontPeek');
        $(this).removeClass('backPeek');

        flipped = true;
    });

    $('.front').hover(
        function() {
            if (flipped) {
                flipped = false;
            }

            $(this).parent().addClass('frontPeek');
        },
        function() {
            if (flipped) {
                flipped = false;
            }

            $(this).parent().removeClass('frontPeek');
        }
    );

    $('.back').hover(
        function() {
            if (flipped) {
                flipped = false;
                return;
            }

            $(this).parent().removeClass('flip');
            $(this).parent().addClass('backPeek');
        },
        function() {
            if (flipped) {
                flipped = false;
                return;
            }

            $(this).parent().removeClass('backPeek');
            $(this).parent().addClass('flip');
        }
    );
});
