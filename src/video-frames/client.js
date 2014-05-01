(function($) {
    var frameGrab,
        framerate,
        videoName;

    function isTouchDevice() {
        return "ontouchstart" in window || navigator.msMaxTouchPoints > 0;
    }

    function openLargerPreview($uploadContainer, size, fileId, name) {
        var $modal = $("#previewDialog"),
            $image = $("#previewContainer"),
            $progress = $modal.find(".progress");

       $modal.find(".modal-title").text("Generating Preview for " + name);
        $image.hide();
        $progress.show();

        $modal
            .one("shown.bs.modal", function() {
                $image.removeAttr("src");
                // setTimeout: Attempt to ensure img.onload is not called after we attempt to draw thumbnail
                // but before picture is transferred to img element as a result of resetting the img.src above.
                setTimeout(function() {
                    $uploadContainer.fineUploader("drawThumbnail", fileId, $image, size).then(function() {
                        $modal.find(".modal-title").text("Preview for " + name);

                        $progress.hide();
                        $image.show();
                    },
                    function() {
                        $progress.hide();
                        $modal.find(".modal-title").text("Preview not available");
                    });
                }, 0);
            })
            .modal("show");
    }

    function showError(message) {
        $("#errorDialog").find(".error-message").text(message);
        $("#errorDialog").modal("show");
    }

    function maybeConstructFramegrab() {
        if (!frameGrab) {
            //TODO Replace window.prompt with nicer-looking modal
            framerate = window.prompt("Please specify framerate");

            if (framerate) {
                frameGrab = new FrameGrab({video: $("#video")[0], frame_rate: framerate});
            }
        }
    }
    function reformatVideoFilename(originalName) {
        var filenameSansExt = originalName,
            extIdx = filenameSansExt.lastIndexOf(".");

        if (extIdx > 0) {
            filenameSansExt = filenameSansExt.substr(0, extIdx);
        }

        return filenameSansExt.replace(/[_-]/g, " ");
    }

    $(function() {
        var descriptions = [];

        $("#uploader").fineUploader({
            debug: true,
            autoUpload: false,
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

            deleteFile: {
                endpoint: "/uploads",
                enabled: true
            },

            display: {
                fileSizeOnSubmit: true,
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
                showError(message);
            },

            callbacks: {
                onSubmitted: function(id, name) {
                    var $file = $(this.getItemByFileId(id)),
                        $thumbnail = $file.find(".qq-thumbnail-selector");

                    $thumbnail.click(function() {
                        openLargerPreview($("#uploader"), 700, id, name);
                    });
                }
            }
        })

            .on("click", ".edit-description", function() {
                var fileId = $("#uploader").fineUploader("getId", this),
                    // TODO replace window.prompt with a nicer-looking modal
                    description = window.prompt("Description for this item", descriptions[fileId] === undefined ? "" : descriptions[fileId]);

                if (description && description.trim().length > 0) {
                    descriptions[fileId] = description;
                    $("#uploader").fineUploader("setParams", {description: description}, fileId);
                }
            });

        $(".grab-frame").click(function() {
            maybeConstructFramegrab();

            frameGrab && frameGrab.grab_now("blob").then(
                function success(result) {
                    var timecode = FrameGrab.secs_to_timecode(result.time, framerate);

                    $("#uploader").fineUploader("addBlobs", {
                        blob: result.container,
                        name: videoName + " - " + timecode
                    });
                },

                function failure(reason) {
                    showError(reason);
                }
            )
        });

        $(".tell-story").click(function() {
            var imageCount = 0;

            maybeConstructFramegrab();

            if (frameGrab) {
                imageCount = parseInt(window.prompt("How many images?"));

                if (imageCount > 0) {
                    frameGrab.make_story("blob", imageCount).then(
                        function success(results) {
                            $.each(results, function() {
                                var timecode = FrameGrab.secs_to_timecode(this.time, framerate);

                                // No guarantee on the order an array of files/blobs is submitted,
                                // so we need to force the order for now.
                                // TODO Adjust Fine Uploader code to ensure submitted order is respected, so we can pass in all blobs at once via an array
                                $("#uploader").fineUploader("addBlobs", {
                                    blob: this.container,
                                    name: videoName + " - " + timecode
                                });
                            });
                        },

                        function failure(reason) {
                            showError(reason);
                        }
                    )
                }
            }
        });

        $("#video-drop-zone").fineUploaderDnd({
            classes: {
                dropActive: "qq-upload-drop-area-active"
            }
        })
            .on("processingDroppedFilesComplete", function(event, files, dropTarget) {
                var file = files[0],
                    name = file.name;

                FrameGrab.make_video(file, $("#video")[0]).then(
                    function success() {
                        frameGrab = null;
                        videoName = reformatVideoFilename(name);
                        $("#video-drop-zone").removeClass("empty");
                    },

                    function failure() {
                        showError("'" + name + "' uses an unsupported video codec or is not a video file");
                    }
                )
            });
    });
})(jQuery);
