import { Component, model, output, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

const EXAMPLE_DATA = `Start,End
25.05.2023,10.08.2023
15.09.2023,20.09.2023
24.12.2023,04.01.2024
05.01.2024,15.01.2024
30.03.2024,03.04.2024
07.04.2024,20.04.2024
10.05.2024,12.05.2024
24.05.2024,01.06.2024
10.06.2024,16.06.2024
05.07.2024,08.08.2024
14.08.2024,20.08.2024
14.12.2024,24.12.2024
26.12.2024,05.01.2025
17.01.2025,20.01.2025
06.04.2025,28.04.2025
16.06.2025,08.08.2025
06.09.2025,13.09.2025
12.10.2025,30.10.2025`;

@Component({
  selector: 'app-trip-input',
  imports: [FormsModule],
  templateUrl: './trip-input.html',
  styleUrl: './trip-input.css',
})
export class TripInput {
  tripText = model('');
  textChanged = output<string>();
  dragOver = false;

  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  loadExample() {
    this.tripText.set(EXAMPLE_DATA);
    this.textChanged.emit(EXAMPLE_DATA);
  }

  onTextChange() {
    this.textChanged.emit(this.tripText());
  }

  onFileClick() {
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.readFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave() {
    this.dragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.readFile(file);
    }
  }

  private readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      this.tripText.set(text);
      this.textChanged.emit(text);
    };
    reader.readAsText(file);
  }
}
