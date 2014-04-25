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

function fixBackHeight() {
    $('.back').height($('.front').height());
}

function showSuggestions() {
    $('#suggestionContainer').show();
    fixBackHeight();
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

function shrinkMediaSelect(divToShrink) {
    divToShrink.addClass('shrink');
    divToShrink.parent().addClass('shrink');
    divToShrink.parent().find('.mediaSelectIcon').addClass('shrink');
    divToShrink.parent().find('.mediaSelectName').addClass('shrink');

    var shrinkIntervalId = setInterval(function() {
        divToShrink.removeClass('shrink');
        divToShrink.parent().removeClass('shrink');
        divToShrink.parent().find('.mediaSelectIcon').removeClass('shrink');
        divToShrink.parent().find('.mediaSelectName').removeClass('shrink');
        hideMediaSelect();
        clearInterval(shrinkIntervalId);
    }, 50);
}

function setCardFlipsAndHovers() {
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
		
		$(function(){
			window.myFlux = new flux.slider('.front');
			
		});
		
		/*$('#suggestion .flipper').cycle({ 
			fx:      'scrollLeft', 
			next:   '#suggestion .flipper', 
			timeout:  0, 
			easing:  'easeInOutBack' 
		});*/
				
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
}

function unsetCardFlipsAndHovers() {
    $('.flip-container .flipper').unbind();
    $('.back').unbind();
    $('.front').unbind();
}

function shrinkSearch() {
    var searchButtonDiv = $('#searchButton');

    searchButtonDiv.addClass('shrink');
    searchButtonDiv.parent().addClass('shrink');
    searchButtonDiv.find('#searchText').addClass('shrink');

    var shrinkIntervalId = setInterval(function() {
        searchButtonDiv.removeClass('shrink');
        searchButtonDiv.parent().removeClass('shrink');
        searchButtonDiv.find('#searchText').removeClass('shrink');

        hideSearch();

        clearInterval(shrinkIntervalId);
    }, 50);
}

$(document).ready(function() {
    showChoices();

    $('.mediaSelectInner').click(function() {
        shrinkMediaSelect($(this));
    });

    $('#searchButton').click(function() {
        shrinkSearch();
    });

    $('#search').keydown(function (e){
        if(e.keyCode == 13){
            hideSearch();
        }
    });
	
	$('#like').click(function() {
			window.myFlux = new flux.slider('.front');

	
	});

    fixBackHeight();

    $(window).resize(function() {
        fixBackHeight();
    });

    setCardFlipsAndHovers();
});
