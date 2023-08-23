window.stylus = (function(){
        if (window.stylus)return;
        const keywords = {
            canvas:function(program,args){
                const canvas = document.getElementById(args[0].value);
                
                program.canvas = canvas;
                program.ctx = canvas.getContext('2d');
                
                program.ctx.imageSmoothingEnabled = false;
                canvas.style.imageRendering = 'pixelated';
            },
            resolution:function(program,args){
                program.width = program.canvas.width = args[0].value;
                program.height = program.canvas.height = args[1].value;
                program.imageData = program.ctx.getImageData(0,0,program.width,program.height);
                program.pixels = program.imageData.data;
                program.pixels.fill(255);
            },
            define:function(program,args){
                program.variables[args[0].value] = [];
                let i;
                for (i=1; i<args.length; i++){
                    program.variables[args[0].value].push(args[i]);
                }
            },
            pixel:function(program,args){
                let index = (0|args[0].value)+(0|args[1].value)*program.width<<2;
                program.pixels[index] = args[2].value;
                program.pixels[index+1] = args[3].value;
                program.pixels[index+2] = args[4].value;
            }
        };
        
        const lexer = (function(){
            const base = {
                character:/[a-zA-Z]/,
                number:/[0-9]/,
                space:/\s/,
                punctuation:/[\:\.\;]/
            };
            const types = {
                number:function(collector){
                    if (collector.length==1&&collector[0].value=='.'){
                        return;
                    }
                    
                    let type=0,value='';
                    
                    let i;
                    for (i=0; i<collector.length; i++){
                        let token = collector[i];
                        if (token.type=='number'){
                            value+=token.value;
                            continue;
                        }
                        if (token.value=='.'){
                            value+=token.value;
                            type++;
                            continue;
                        }
                        return;
                    }
                    if (type>1){
                        throw 'Syntax Error: Invalid Number Format';
                    }
                    
                    return value;
                },
                identifier:function(collector){
                    let value = '';
                    
                    let i;
                    for (i=0; i<collector.length; i++){
                        let token = collector[i];
                        if (token.type=='character'){
                            value+=token.value;
                            continue;
                        }
                        if (token.type=='number'){
                            if (value==''){
                                return;
                            }
                            value+=token.value;
                            continue;
                        }
                        return;
                    }
                    
                    return value;
                }
            };
            
            const seperators = [
                'space',
                'operator',
                'punctuation'
            ];
            const exceptions = [
                '<type:number><seperator><value:.><type:number>',
                '<type:space><seperator><value:.><type:number>',
                '<type:number><seperator><value:.><type:space>'
            ];
            exceptions.forEach(function(string,index){
                let constructed = [];
                
                let args = string.replaceAll('<','').split('>');
                args.pop();
                
                let zero = args.indexOf('seperator');
                args.splice(zero,1);
                
                args.forEach(function(e,i){
                    let subargs = e.split(':');
                    constructed.push({
                        search:subargs[0],
                        value:subargs[1],
                        index:zero-i
                    });
                });
                
                exceptions[index] = constructed;
            });
            
            return function(string){
                let tokens = Array.from(string);
                tokens = tokens.map(function(e){
                    let type = -1;
                    for (const key in base){
                        if (base[key].test(e)==true){
                            type = key;
                            break;
                        }
                    }
                    if (type==-1){
                        throw 'Illegal Character "'+e+'"';
                    }
                    return {type:type,value:e};
                });
                
                const result = [];
                const collector = [];
                
                function validate(tokens,current){
                    if (seperators.includes(tokens[current].type)==false){
                        return false;
                    }
                    
                    let i,j;
                    for (i=0; i<exceptions.length; i++){
                        let exception = exceptions[i];
                        for (j=0; j<exception.length; j++){
                            let data = exception[j];
                            if (!tokens[current-data.index])return false;
                            if (tokens[current-data.index][data.search]!=data.value){
                                break;
                            }
                        }
                        if (j==exception.length){
                            return false;
                        }
                    }
                    
                    return true;
                }
                function collect(token){
                    if (tokens[current].type!='space'){
                        collector.push(tokens[current]);
                    }
                }
                function pop(){
                    if (collector.length==0)return;
                    let token;
                    for (const key in types){
                        const value = types[key](collector);
                        if (value!=void 0){
                            token = {type:key,value:value};
                            break;
                        }
                    }
                    if (!token&&collector.length==1){
                        token = collector[0];
                    }
                    if (token)result.push(token);
                    else {
                        let pattern = '';
                        collector.forEach(function(e){
                            pattern+=e.value;
                        });
                        throw 'Syntax Error: Illegal Pattern: '+pattern;
                    }
                    collector.length = 0;
                }
                
                let current = 0;
                while(current<tokens.length){
                    if (validate(tokens,current)==true){
                        pop();
                        collect(tokens[current]);
                        pop();
                    }
                    else{
                        collect(tokens[current]);
                    }
                    current++;
                }
                pop();
                
                return result.map(function(e){
                    if (e.type=='identifier'){
                        if (keywords[e.value]){
                            e.type = 'keyword';
                        }
                    }
                    return e;
                });
            };
        })();
        const parser = (function(){
            return function(tokens){
                let current = 0;
                function check(type,value){
                    if (type&&tokens[current].type!=type){
                        throw 'Parser Error';
                    }
                    if (value&&tokens[current].value!=value){
                        throw 'Parser Error';
                    }
                    return tokens[current++].value;
                }
                function step(){
                    let keyword = check('keyword');
                    let punctuation = check(null,':');
                    let args = [];
                    let end = false;
                    
                    while(current<tokens.length){
                        if (tokens[current].value==';'){
                            check(null,';');
                            end = true;
                            break;
                        }
                        if (tokens[current].type=='keyword'){
                            throw 'Parser Error';
                        }
                        args.push(tokens[current++]);
                    }
                    
                    if (end==false){
                        throw 'Parser Error';
                    }
                    
                    return {
                        type:'statement',
                        keyword:keyword,
                        arguments:args
                    };
                }
                
                const statements = [];
                while(current<tokens.length){
                    statements.push(step());
                }
                
                return statements;
            };
        })();
        function run(text){
            let instructions;
            try{
                instructions = parser(lexer(text));
            }
            catch(e){
                return -1;
            }
            
            const program = {
                variables:[]
            };
            instructions.forEach(function(e){
                let args = [];
                e.arguments.forEach(function(argument){
                    if (argument.type=='identifier'){
                        if (program.variables[argument.value]){
                            program.variables[argument.value].forEach(function(token){
                                args.push(token);
                            });
                        }
                        else{
                            args.push(argument);
                        }
                    }
                    else{
                        args.push(argument);
                    }
                });
                keywords[e.keyword](program,args);
            });
            program.ctx.putImageData(program.imageData,0,0);
        }
        
        window.addEventListener('DOMContentLoaded',function(){
            const scripts = document.querySelectorAll('script[type="stylus"]');
            scripts.forEach(function(script){
                run(script.text);
            });
        },false);
        
        return 1;
    })();
