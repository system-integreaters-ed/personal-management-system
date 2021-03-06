var imagesLoaded = require('imagesloaded');

export default (function () {
    if (typeof window.ui === 'undefined') {
        window.ui = {};
    }
    ui.ajax = {
        methods: {
            singleMenuNodeReload: {
                url: '/actions/render-menu-node-template',
                method: "POST"
            },
            getFormView: {
                url: '/api/get-form-view-by-class-name',
                method: "POST"
            },
            getTemplateData: {
                url: '/api/get-template-data', // not implemented on backend
                method: "GET"
            }
        },
        data: {
          reloadTargetElementData : "data-reload-target-element-data",
          targetElementSelector   : "data-target-element-selector",
          templateLocation        : "data-template-location",
          templateData            : "data-template-data",
          jsLogic                 : "data-js-logic"
        },
        init: function(){
            this.attachModuleContentLoadingViaAjaxOnMenuLinks();
        },
        /**
         * Will reload menu node
         * @param menuNodeModuleName
         * @param returnNotification
         */
        singleMenuNodeReload: function(menuNodeModuleName = null, returnNotification = false) {

            let $menuNode = null;

            if(
                    null === menuNodeModuleName
                || "undefined" === typeof menuNodeModuleName
            ){
                let $currentActiveMenuLink = $('a.sidebar-link.active');
                $menuNode                   = $currentActiveMenuLink.closest('.sidebar-menu-node-element');
                menuNodeModuleName          = $menuNode.attr('data-menu-node-name');
            }else{
                $menuNode = $('.sidebar-menu-node-element[data-menu-node-name^="' + menuNodeModuleName + '"]');
            }

            if( "undefined" === typeof menuNodeModuleName ){
                throw("Menu node name was not defined");
            }

            if( 0 === $menuNode.length ){
                throw('Menu node with name: ' + menuNodeModuleName + ' - was not found');
            }

            if( 1 < $menuNode.length ){
                throw('More than one menu nodes with name: ' + menuNodeModuleName + ' were found.');
            }

            let data = {
                "menu_node_module_name": menuNodeModuleName
            };

            let url    = this.methods.singleMenuNodeReload.url;
            let method = this.methods.singleMenuNodeReload.method;

            $.ajax({
                url: url,
                method: method,
                data: data,
            }).always((data) => {

                let message          = data['message'];
                let code             = data['code'];
                let tpl              = data['tpl'];
                let reloadPage       = data['reload_page'];
                let reloadMessage    = data['reload_message'];
                let notificationType = ( code == 200 ? "success" : "danger" );

                if( "undefined" === typeof message ){
                    return;
                }

                if( '' !== tpl ){
                    $menuNode.replaceWith(tpl);
                    window.sidebar.links.init();
                    initializer.reinitialize();
                }

                if(returnNotification){
                    bootstrap_notifications.notify(message, notificationType)
                }

                this.attachModuleContentLoadingViaAjaxOnMenuLinks();

                if( reloadPage ){
                    if( "" !== reloadMessage ){
                        bootstrap_notifications.showBlueNotification(reloadMessage);
                    }
                    location.reload();
                }
            });
        },
        /**
         * Attaches ajax call event `onclick` - will reload main content of module
         */
        attachModuleContentLoadingViaAjaxOnMenuLinks: function(){

            let _this = this;
            let excludeHrefsRegexPatterns = [
                /^javascript.*/g,
                /^#.*/g
            ];

            let allElements = $('.sidebar-menu .sidebar-link, .ajax-content-load');

            $.each(allElements, (index, element) => {
                let href = $(element).attr('href');
                let skip = false;

                $.each(excludeHrefsRegexPatterns, (index, pattern) => {
                    if( null !== href.match(pattern) ){
                        skip = true;
                    }
                });

                if ( !skip && "" == href ){
                    skip = true;
                }

                if( !skip ){

                    $(element).on('click', (event) => {

                        event.preventDefault();
                        _this.loadModuleContentByUrl(href);
                    })

                }

            })



        },
        /**
         * @param url           {string}
         * @param callbackAfter {function}
         * @param showMessages  {boolean}
         * @description This method will fetch module template and load it into mainBody, not showing message here on purpose
         */
        loadModuleContentByUrl: function (url, callbackAfter = undefined, showMessages = false){

            // fix for case when this call comes as second and somehow the previous call for hideLoader instantly hides also this one
            setTimeout(function(){
                ui.widgets.loader.showLoader();
            }, 500);

            $.ajax({
                url: url,
                method: "GET",
            }).always((data) => {
                let twigBodySection = $('.twig-body-section');

                try{
                    var code          = data['code'];
                    var message       = data['message'];
                    var template      = data['template'];
                    var reloadPage    = data['reload_page'];
                    var reloadMessage = data['reload_message'];
                } catch(Exception){
                    throw({
                        "message"   : "Could not handle ajax call",
                        "data"      : data,
                        "exception" : Exception
                    })
                }

                if( "undefined" !== typeof template ){
                    twigBodySection.html(template);
                }

                if( "function" === typeof callbackAfter ){
                    callbackAfter();
                }

                /**
                 * Despite this being called imagesLoaded it works fine with normal content as well
                 * This is badly required for case when module contains images
                 */
                imagesLoaded( twigBodySection, function() {
                    initializer.reinitialize();
                    ui.widgets.loader.hideLoader();
                    history.pushState({}, null, url);
                    sidebar.links.markCurrentMenuElementAsActive();
                    ui.masonry.init();
                });

                if( reloadPage ){
                    if( "" !== reloadMessage ){
                        bootstrap_notifications.showBlueNotification(reloadMessage);
                    }
                    location.reload();
                }
            });
        },
        /**
         * This function will get the form view for namespace if such form exists, otherwise - error
         * @param namespace
         * @param callback
         * @param stripFormTag    - if set to true then form opening and closing tags will removed ,
         *  this is required in case when one form is subform, it won't even send data to backend,
         *  symfony does not allow to submit multiple forms at once.
         */
        getFormViewByNamespace: function(namespace, callback, stripFormTag = true){

            ui.widgets.loader.showLoader();

            let data = {
                'form_namespace': namespace
            };

            $.ajax({
                url: this.methods.getFormView.url,
                method: this.methods.getFormView.method,
                data: data
            }).always((data) => {
                ui.widgets.loader.hideLoader();

                let error         = data['error'];
                let formView      = data['form_view'];
                let reloadPage    = data['reload_page'];
                let reloadMessage = data['reload_message'];


                if( "undefined" !== typeof error ){
                    bootstrap_notifications.notify(error, 'danger');
                    return false;
                }

                if( stripFormTag ){
                    formView = formView.replace(/<(.*?)form(.*?)>/, '');
                    formView = formView.replace('</form>','');
                }

                if( "function" === typeof callback ){
                    callback(formView);
                }

                if( reloadPage ){
                    if( "" !== reloadMessage ){
                        bootstrap_notifications.showBlueNotification(reloadMessage);
                    }
                    location.reload();
                }
            });
        },
        /**
         * @deprecated - not used and not tested after adding
         * @description
         * - fetches template content,
         * - uses the provided data to generate template,
         * - inserts template data into target element,
         * - attaches additional js logic,
         */
        reloadTargetPageElementByTemplateLocationAndTemplateDataOnClick: function(){

            let $allElementsToAttachEventOn = $(this.data.reloadTargetElementData + "=[true]");
            let _this                       = this;

            $.each($allElementsToAttachEventOn, function(element, index){
               let $element = $(element);

               $element.on('click', function(){

                   let targetElementSelector = $element.attr(_this.data.targetElementSelector);
                   let templateLocation      = $element.attr(_this.data.templateLocation);
                   let templateData          = $element.attr(_this.data.templateData);
                   let jsLogic               = $element.attr(_this.data.jsLogic);

                   let $targetElement = $(targetElementSelector);

                   if( 0 === $targetElement.length ){
                       throw({
                          "message"  : "No element was found for given selector",
                          "selector" : targetElementSelector
                       });
                   }else if(1 < $targetElement.length){
                       throw({
                           "message"  : "More than one element was found for given selector",
                           "selector" : targetElementSelector,
                           "elements" : $targetElement
                       })
                   }

                    let callbackAfterGettingRenderedTemplate = function(renderedTemplate){
                       $targetElement.html(renderedTemplate);
                       let func = new Function(jsLogic);
                       func();
                    };

                   let dataArray = {
                       'templateLocation' : templateLocation,
                       'templateData'     : templateData,
                   };

                   _this.getRenderedTemplateForTemplateLocationAndData(dataArray, callbackAfterGettingRenderedTemplate)

               })
            });
        },
        /**
         * @deprecated - not used and not tested after adding
         * @param dataArray  {object}
         * @param callback   {function}
         */
        getRenderedTemplateForTemplateLocationAndData: function(dataArray, callback = null){

            let _this = this;

            $.ajax({
                url: _this.methods.getTemplateData,
                data: dataArray,
            }).always(function(data){

                try{
                    var template      = data['template'];
                    var code          = data['code'];
                    var reloadPage    = data['reload_page'];
                    var reloadMessage = data['reload_message'];
                }catch(Exception){
                    throw{
                        "message": "Exception was throw while trying to get data from ajax get rendered template",
                        "exc"    : Exception,
                    }
                }

                if( 200 == code){
                    if( "function" === typeof callback ){
                        callback(template);
                    }
                }

                if( reloadPage ){
                    if( "" !== reloadMessage ){
                        bootstrap_notifications.showBlueNotification(reloadMessage);
                    }
                    location.reload();
                }
            })
        }
    };
}());
