(function($) {
    function isTouchDevice() {
        return "ontouchstart" in window || navigator.msMaxTouchPoints > 0;
    }

    function applyNewText(propertyName, $scope, newText) {
        $scope.$apply(function() {
            $scope[propertyName] = newText;
        });
    }

    function openLargerPreview($scope, $uploadContainer, size, fileId, name) {
        var $modal = $("#previewDialog"),
            $image = $("#previewContainer"),
            $progress = $modal.find(".progress");

//        applyNewText("previewTitle", $scope, "Generating Preview for " + name);
        $image.hide();
        $progress.show();

        $modal
            .one("shown.bs.modal", function() {
                $image.removeAttr("src");
                // setTimeout: Attempt to ensure img.onload is not called after we attempt to draw thumbnail
                // but before picture is transferred to img element as a result of resetting the img.src above.
                setTimeout(function() {
                    $uploadContainer.fineUploader("drawThumbnail", fileId, $image, size).then(function() {
                        applyNewText("previewTitle", $scope, "Preview for " + name);

                        $progress.hide();
                        $image.show();
                    },
                    function() {
                        $progress.hide();
//                        applyNewText("previewTitle", $scope, "Preview not available");
                    });
                }, 0);
            })
            .modal("show");
    }

    $(function() {
        $("#uploader").fineUploader({
            debug: true,
            request: {
                endpoint: "/uploads",
                params: {
                    sendThumbnailUrl: !qq.supportedFeatures.imagePreviews
                }
            },

            thumbnails: {
                placeholders: {
                    notAvailablePath: "/placeholders/not_available-generic.png",
                    waitingPath: "/placeholders/waiting-generic.png"
                }
            },

            display: {
                prependFiles: true
            },

            failedUploadTextDisplay: {
                mode: "custom"
            },

            retry: {
                enableAuto: true
            },

            chunking: {
                enabled: true
            },

            resume: {
                enabled: true
            },

            showMessage: function(message) {
    //            applyNewText("errorMessage", $scope, message);
                $("#errorDialog").modal("show");
            },

            callbacks: {
                onSubmitted: function(id, name) {
                    var $file = $(this.getItemByFileId(id)),
                        $thumbnail = $file.find(".qq-thumbnail-selector");

                    $thumbnail.click(function() {
                        openLargerPreview($scope, $(element), largePreviewSize, id, name);
                    });
                }
            }
        });
    });
})(jQuery);
