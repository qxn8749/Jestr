function showChoice(selector) {
    $(selector).addClass('show');
    $(selector).parent().addClass('show');
    $(selector).parent().find('.mediaSelectIcon').addClass('show');
    $(selector).parent().find('.mediaSelectName').addClass('show');
}

function showChoices() {
    var count = 0;
    var intervalId = setInterval(function() {
        if (count == 0) {
            showChoice('.games');
        } else if (count == 1) {
            showChoice('.movies');
        } else if (count == 2) {
            showChoice('.books');
            
            clearInterval(intervalId);
        }
        
        count++;
    }, 100);
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
            clearInterval(shrinkIntervalId);
        }, 50);
    });

    $('#moreInfoButton').click(function() {
        if ($('#moreInfo').hasClass('show')) {
            $('#moreInfo').removeClass('show');
        } else {
            $('#moreInfo').addClass('show');
        }
    });
});