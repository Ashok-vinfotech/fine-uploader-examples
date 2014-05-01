(function($) {
    var currentVideoId,
        frameGrab,
        framerates = {},
        videoName,
        descriptions = [],
        timeInSecs = [],
        durations = [];

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

    function showPleaseWait() {
        $("#pleaseWaitDialog").modal("show");
    }

    function hidePleaseWait() {
        $("#pleaseWaitDialog").modal("hide");
    }

    function showError(message) {
        $("#errorDialog").find(".error-message").text(message);
        $("#errorDialog").modal("show");
    }

    function maybeConstructFramegrab() {
        if (!frameGrab) {
            //TODO Replace window.prompt with nicer-looking modal
            if (!framerates[currentVideoId]) {
                framerates[currentVideoId] = parseFloat(window.prompt("Please specify framerate"));
            }

            if (framerates[currentVideoId]) {
                frameGrab = new FrameGrab({
                    video: $("#video")[0],
                    frame_rate: framerates[currentVideoId],
                    skip_solids: {
                        enabled: true
                    }
                });
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

    function sortFramesInUi() {
        var ordered = $("[data-video-id='" + currentVideoId + "']").sort(function(a, b) {
            var timeA = parseFloat($(a).data("time")),
                timeB = parseFloat($(b).data("time"));

            if (timeA < timeB) {
                return 1;
            }
            if (timeA > timeB) {
                return -1;
            }
            return 0;
        });

        $(".qq-upload-list-selector").prepend(ordered);
    }

    $(function() {
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
                onStatusChange: function() {
                    var submittedCount = this.getUploads({status: qq.status.SUBMITTED}).length;

                    if (submittedCount) {
                        $("#start-upload-button").show();
                    }
                    else {
                        $("#start-upload-button").hide();
                    }
                },

                onSubmitted: function(id, name) {
                    var $file = $(this.getItemByFileId(id)),
                        $thumbnail = $file.find(".qq-thumbnail-selector"),
                        file = this.getFile(id);

                    timeInSecs[id] = file.timeInSecs;

                    $file.data("time", timeInSecs[id]);
                    $file.attr("data-video-id", currentVideoId);
                    sortFramesInUi();

                    durations[id] = $("#video")[0].duration;
                    $thumbnail.click(function() {
                        // TODO replace with carousel
                        openLargerPreview($("#uploader"), 700, id, name);
                    });
                },

                onUpload: function(id) {
                    var params = {
                            time: timeInSecs[id],
                            duration: durations[id]
                        },
                        $file = $(this.getItemByFileId(id));

                    if (descriptions[id]) {
                        params.description = descriptions[id];
                    }

                    this.setParams(params, id);
                    $file.find(".qq-upload-cancel-selector").text("Cancel");
                }
            }
        })

            .on("click", ".edit-description", function() {
                var fileId = $("#uploader").fineUploader("getId", this),
                    // TODO replace window.prompt with a nicer-looking modal
                    description = window.prompt("Description for this item", descriptions[fileId] === undefined ? "" : descriptions[fileId]);

                if (description && description.trim().length > 0) {
                    descriptions[fileId] = description;
                }
            });

        $(".grab-frame").click(function() {
            maybeConstructFramegrab();

            frameGrab && frameGrab.grab_now("blob").then(
                function success(result) {
                    var timecode = FrameGrab.secs_to_timecode(result.time, framerates[currentVideoId]);

                    // setParams is a bit inflexible in FU.
                    // TODO Add an `updateParams` and/or `getParams` API method to FU.
                    result.container.timeInSecs = result.time;

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
                    showPleaseWait();

                    frameGrab.make_story("blob", imageCount).then(
                        function success(results) {
                            $.each(results, function() {
                                hidePleaseWait();

                                var timecode = FrameGrab.secs_to_timecode(this.time, framerates[currentVideoId]);

                                // setParams is a bit inflexible in FU.
                                // TODO Add an `updateParams` and/or `getParams` API method to FU.
                                this.container.timeInSecs = this.time;

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
                            hidePleaseWait();
                            showError(reason);
                        }
                    )
                }
            }
        });

        $("#start-upload-button").hide()
            .click(function() {
                $("#uploader").fineUploader("uploadStoredFiles");
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
                        currentVideoId = name;
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
