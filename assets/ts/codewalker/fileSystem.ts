export async function readDirectory(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
    let directoryReader = directory.createReader();

    let res: FileSystemEntry[] = [];

    return new Promise((resolve) => {
        let cb = (entries: FileSystemEntry[]) => {
            if (entries.length) {
                res.push(...entries);

                directoryReader.readEntries(cb);
            } else {
                resolve(res);
            }
        };

        directoryReader.readEntries(cb);
    });
}

export async function readFileAsText(fileEntry: FileSystemFileEntry): Promise<string | null> {
    let file = await _getFileEntryAsFile(fileEntry);

    return new Promise((resolve, reject) => {
        let reader: FileReader = new FileReader();

        reader.onload = (e) => {
            if (e.target && e.target.result) {
                resolve(e.target.result as string);
            } else {
                resolve(null);
            }
        }

        reader.readAsText(file);
    });
}

export async function readFileAsDataURL(fileEntry: FileSystemFileEntry): Promise<string | null> {
    let file = await _getFileEntryAsFile(fileEntry);

    return new Promise((resolve, reject) => {
        let reader = new FileReader();

        reader.onload = (e) => {
            if (e.target && e.target.result) {
                resolve(e.target.result as string);
            } else {
                resolve(null);
            }
        }

        reader.readAsDataURL(file);
    });
}

function _getFileEntryAsFile(fileEntry: FileSystemFileEntry): Promise<File> {
    return new Promise((resolve, reject) => {
        fileEntry.file(resolve, reject);
    });
}